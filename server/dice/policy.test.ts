import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCKED_SUBREDDITS,
  isBlocked,
  normaliseSubreddit,
  resolveActions,
  screenSignal,
  searchableSubreddits,
} from './policy';
import { buildDesk } from './accounts';
import type { Desk, RawSignal } from './types';

/**
 * The policy floor. These are the rules that no configuration, no operator
 * click, and no score is allowed to get around.
 */

const raw = (over: Partial<RawSignal> = {}): RawSignal => ({
  sourceId: 'fixture:test:1',
  subreddit: 'jobs',
  postId: 'p1',
  author: 'someone',
  title: 'Got laid off today',
  body: 'No warning at all. Any advice on what to do first?',
  permalink: 'https://reddit.com/r/jobs/comments/p1',
  createdAt: new Date().toISOString(),
  ...over,
});

const desk = (over: Partial<Desk> = {}): Desk => ({
  ...buildDesk('stabilizer'),
  auth: 'connected',
  grants: { read: true, comment: true, message: true },
  ...over,
});

test('crisis-support subreddits are blocked and cannot be un-blocked by config', () => {
  for (const rule of BLOCKED_SUBREDDITS) {
    assert.ok(isBlocked(rule.name), `${rule.name} should be blocked`);
    // Even if an operator lists it as a target, it is refused rather than searched.
    const scope = searchableSubreddits(desk({ lens: { ...desk().lens, subreddits: [rule.name] } }));
    assert.deepEqual(scope.allowed, [], `${rule.name} must never be searchable`);
    assert.equal(scope.refused.length, 1);
  }
});

test('subreddit names normalise across r/ prefixes and casing', () => {
  assert.equal(normaliseSubreddit('r/SuicideWatch'), 'suicidewatch');
  assert.equal(normaliseSubreddit('/r/Jobs'), 'jobs');
  assert.ok(isBlocked('r/SuicideWatch'));
  assert.ok(isBlocked('/r/depression'));
});

test('a post in a blocked subreddit is screened out before scoring', () => {
  const outcome = screenSignal(raw({ subreddit: 'depression' }));
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.state, 'blocked');
});

test('crisis language means do-not-contact, never high priority', () => {
  const outcome = screenSignal(raw({ body: "I don't want to be here anymore, nothing helps" }));
  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.state, 'do-not-contact');
    assert.match(outcome.reason, /not a prospect/);
  }
});

test('ordinary distress is not screened out — that is the whole market', () => {
  assert.equal(screenSignal(raw({ body: 'I am completely burned out and exhausted' })).ok, true);
  assert.equal(screenSignal(raw({ body: 'this job is killing me slowly' })).ok, true);
});

test('actions default to denied on an unreviewed subreddit', () => {
  const actions = resolveActions(desk(), 'someunlistedsubreddit', { ok: true }, null);
  assert.equal(actions.reply.allowed, false);
  assert.match(actions.reply.reason, /no reviewed rule entry/);
  assert.equal(actions.message.allowed, false);
});

test('replying is allowed only where the subreddit was reviewed and marked', () => {
  assert.equal(resolveActions(desk(), 'jobs', { ok: true }, null).reply.allowed, true);
  assert.equal(resolveActions(desk(), 'productivity', { ok: true }, null).reply.allowed, true);
});

test('direct messaging is denied everywhere, by policy not by omission', () => {
  for (const subreddit of ['jobs', 'productivity', 'college', 'unlisted']) {
    const actions = resolveActions(desk(), subreddit, { ok: true }, null);
    assert.equal(actions.message.allowed, false, subreddit);
  }
  assert.match(resolveActions(desk(), 'jobs', { ok: true }, null).message.reason, /policy decision/);
});

test('a desk without a comment grant cannot reply even in an allowed subreddit', () => {
  const noComment = desk({ grants: { read: true, comment: false, message: false } });
  const actions = resolveActions(noComment, 'jobs', { ok: true }, null);
  assert.equal(actions.reply.allowed, false);
  assert.match(actions.reply.reason, /no comment grant/);
});

test('a disconnected desk cannot act at all', () => {
  for (const auth of ['expired', 'disconnected', 'not-configured'] as const) {
    const actions = resolveActions(desk({ auth }), 'jobs', { ok: true }, null);
    assert.equal(actions.reply.allowed, false, auth);
    assert.match(actions.reply.reason, new RegExp(auth));
  }
});

test('a collision denies both actions and names the other desk', () => {
  const actions = resolveActions(desk(), 'jobs', { ok: true }, {
    deskId: 'regulator',
    at: new Date().toISOString(),
    state: 'replied',
    on: 'author',
  });
  assert.equal(actions.reply.allowed, false);
  assert.match(actions.reply.reason, /regulator/);
  assert.match(actions.reply.reason, /same person/);
});

test('a screened-out signal denies both actions whatever else is true', () => {
  const screened = screenSignal(raw({ body: 'I want to kill myself' }));
  const actions = resolveActions(desk(), 'jobs', screened, null);
  assert.equal(actions.reply.allowed, false);
  assert.equal(actions.message.allowed, false);
});
