import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePaste, parseRedditUrl, toRawSignal } from './ingest';

const NOW = new Date('2026-03-02T12:00:00.000Z');

test('parses the Reddit permalink forms an operator will actually paste', () => {
  const forms = [
    'https://www.reddit.com/r/jobs/comments/1abc234/got_laid_off_this_morning/',
    'https://reddit.com/r/jobs/comments/1abc234/got_laid_off_this_morning',
    'https://old.reddit.com/r/jobs/comments/1abc234/got_laid_off_this_morning/',
    'https://np.reddit.com/r/jobs/comments/1abc234/got_laid_off_this_morning/',
    'https://www.reddit.com/r/jobs/comments/1abc234/got_laid_off_this_morning/?utm_source=share',
  ];
  for (const url of forms) {
    const parsed = parseRedditUrl(url);
    assert.equal(parsed.ok, true, url);
    if (parsed.ok) {
      assert.equal(parsed.value.subreddit, 'jobs');
      assert.equal(parsed.value.postId, '1abc234');
      assert.equal(parsed.value.title, 'Got laid off this morning');
    }
  }
});

test('tracking parameters cannot defeat deduplication', () => {
  const plain = parseRedditUrl('https://www.reddit.com/r/jobs/comments/1abc234/slug/');
  const tracked = parseRedditUrl('https://www.reddit.com/r/jobs/comments/1abc234/slug/?utm_source=share&utm_medium=ios');
  assert.equal(plain.ok && tracked.ok && plain.value.url === tracked.value.url, true);
});

test('a comment permalink still resolves to its parent post', () => {
  const parsed = parseRedditUrl('https://www.reddit.com/r/jobs/comments/1abc234/slug/9zzz111/');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.postId, '1abc234');
});

test('short links are refused with an instruction, not silently dropped', () => {
  const parsed = parseRedditUrl('https://redd.it/1abc234');
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.match(parsed.reason, /full URL/);
});

test('non-Reddit and malformed URLs are refused with a reason', () => {
  for (const url of ['https://example.com/r/jobs/comments/1/x/', 'not a url', 'https://www.reddit.com/r/jobs/']) {
    const parsed = parseRedditUrl(url);
    assert.equal(parsed.ok, false, url);
    if (!parsed.ok) assert.ok(parsed.reason.length > 0);
  }
});

test('a bare list of URLs parses as one entry each', () => {
  const paste = `
https://www.reddit.com/r/jobs/comments/aaa111/got_laid_off/
https://www.reddit.com/r/layoffs/comments/bbb222/role_eliminated/
https://www.reddit.com/r/antiwork/comments/ccc333/burned_out/
`;
  const { entries, failures } = parsePaste(paste, NOW);
  assert.equal(entries.length, 3);
  assert.equal(failures.length, 0);
  assert.deepEqual(entries.map((e) => e.subreddit), ['jobs', 'layoffs', 'antiwork']);
  for (const entry of entries) assert.equal(entry.capture, 'url-only');
});

test('a URL followed by text captures the body', () => {
  const paste = `https://www.reddit.com/r/jobs/comments/aaa111/got_laid_off/
u/quiet_user_88
posted: 3h
They gave me four weeks and I have no idea what to do first.
Any advice on the first 24 hours?`;

  const { entries } = parsePaste(paste, NOW);
  assert.equal(entries.length, 1);
  const [entry] = entries;
  assert.equal(entry.capture, 'with-body');
  assert.equal(entry.author, 'quiet_user_88');
  assert.match(entry.body, /four weeks/);
  assert.match(entry.body, /first 24 hours/);
  // The age line is consumed as metadata, not left in the body.
  assert.doesNotMatch(entry.body, /posted:/);
  assert.equal(entry.createdAt, new Date(NOW.getTime() - 3 * 3_600_000).toISOString());
});

test('mixed bare links and full posts parse together', () => {
  const paste = `https://www.reddit.com/r/jobs/comments/aaa111/first/
Body for the first one.

https://www.reddit.com/r/jobs/comments/bbb222/second/

https://www.reddit.com/r/jobs/comments/ccc333/third/
Body for the third.`;

  const { entries } = parsePaste(paste, NOW);
  assert.deepEqual(entries.map((e) => e.capture), ['with-body', 'url-only', 'with-body']);
});

test('unparseable lines are reported rather than swallowed', () => {
  const paste = `https://redd.it/xyz
https://www.reddit.com/r/jobs/comments/aaa111/ok/`;
  const { entries, failures } = parsePaste(paste, NOW);
  assert.equal(entries.length, 1);
  assert.equal(failures.length, 1);
  assert.match(failures[0].reason, /full URL/);
});

test('text before any URL is reported instead of attaching to nothing', () => {
  const { failures } = parsePaste('some stray notes\nhttps://www.reddit.com/r/jobs/comments/a1/x/', NOW);
  assert.equal(failures.length, 1);
  assert.match(failures[0].reason, /start each post with its link/);
});

test('a pasted entry becomes the same shape an automated source returns', () => {
  const { entries } = parsePaste('https://www.reddit.com/r/jobs/comments/aaa111/got_laid_off/', NOW);
  const raw = toRawSignal(entries[0], 'stabilizer', NOW);

  assert.equal(raw.subreddit, 'jobs');
  assert.equal(raw.postId, 'aaa111');
  assert.equal(raw.title, 'Got laid off');
  assert.equal(raw.permalink, 'https://www.reddit.com/r/jobs/comments/aaa111/');
  assert.equal(raw.author, 'unknown', 'an unstated author is unknown, not invented');
  assert.equal(raw.createdAt, NOW.toISOString());
  assert.match(raw.sourceId, /^manual:stabilizer:/);
});

test('an empty paste yields nothing rather than throwing', () => {
  const { entries, failures } = parsePaste('   \n\n  ', NOW);
  assert.deepEqual(entries, []);
  assert.deepEqual(failures, []);
});
