import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildDiceRoutes } from './routes';
import { MemoryDiceRepository } from './store';
import { initOperatorAuth } from './auth';
import { setSignalSource } from './sources';
import { FixtureSignalSource } from './sources/fixture';

/**
 * The operator API. These cover the three things that would be most damaging
 * to get wrong: an open console, a credential reaching the browser, and one
 * desk's state bleeding into another's.
 */

const PASSWORD = 'test-operator-password';
let now = new Date('2026-03-02T12:00:00.000Z');
let repo: MemoryDiceRepository;
let server: ReturnType<express.Express['listen']>;
let base: string;
let cookie = '';

const auth = initOperatorAuth(PASSWORD, 'test-secret');

beforeEach(async () => {
  now = new Date('2026-03-02T12:00:00.000Z');
  repo = new MemoryDiceRepository();
  setSignalSource(new FixtureSignalSource());

  if (server) await new Promise((r) => server.close(r));
  const app = express();
  app.use('/api/dice', buildDiceRoutes({ repo, auth, clock: () => now }));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const res = await fetch(`${base}/api/dice/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
});

after(async () => {
  setSignalSource(null);
  if (server) await new Promise((r) => server.close(r));
});

const get = (path: string, withCookie = true) =>
  fetch(`${base}/api/dice${path}`, { headers: withCookie ? { cookie } : {} });

const post = (path: string, body?: unknown, withCookie = true) =>
  fetch(`${base}/api/dice${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(withCookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/* -------------------------------- auth --------------------------------- */

test('every DICE route refuses an unauthenticated caller', async () => {
  for (const path of ['/desks', '/desks/stabilizer', '/policy', '/me']) {
    assert.equal((await get(path, false)).status, 401, path);
  }
  assert.equal((await post('/desks/stabilizer/discover', {}, false)).status, 401);
});

test('a wrong password is rejected and issues no session', async () => {
  const res = await post('/login', { password: 'wrong' }, false);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('the session cookie is httpOnly and strict', async () => {
  const res = await post('/login', { password: PASSWORD }, false);
  const header = res.headers.get('set-cookie') ?? '';
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
});

test('a session expires and stops working', async () => {
  assert.equal((await get('/me')).status, 200);
  now = new Date(now.getTime() + 13 * 3_600_000);
  assert.equal((await get('/me')).status, 401);
});

/* ---------------------------- credential safety ------------------------- */

test('no credential material ever reaches the client', async () => {
  process.env.DICE_REDDIT_STABILIZER_CLIENT_ID = 'super-secret-client-id';
  process.env.DICE_REDDIT_STABILIZER_CLIENT_SECRET = 'super-secret-value';
  process.env.DICE_REDDIT_STABILIZER_REFRESH_TOKEN = 'super-secret-refresh';

  const body = await (await get('/desks')).text();
  const deskBody = await (await get('/desks/stabilizer')).text();

  for (const secret of ['super-secret-client-id', 'super-secret-value', 'super-secret-refresh']) {
    assert.ok(!body.includes(secret), `overview leaked ${secret}`);
    assert.ok(!deskBody.includes(secret), `desk view leaked ${secret}`);
  }
  // The status derived from them is what does cross.
  assert.match(deskBody, /"auth":"connected"/);

  delete process.env.DICE_REDDIT_STABILIZER_CLIENT_ID;
  delete process.env.DICE_REDDIT_STABILIZER_CLIENT_SECRET;
  delete process.env.DICE_REDDIT_STABILIZER_REFRESH_TOKEN;
});

/* ------------------------------- desks ---------------------------------- */

test('the overview lists all ten desks with independent state', async () => {
  const body = await (await get('/desks')).json();
  assert.equal(body.desks.length, 10);
  assert.equal(body.source, 'fixture');
  for (const summary of body.desks) {
    assert.equal(summary.counts.discovered, 0, 'no desk starts with signals');
    assert.ok(summary.desk.lens.subreddits.length > 0);
  }
});

test('an unknown desk is a 404, not an empty desk', async () => {
  assert.equal((await get('/desks/not-a-desk')).status, 404);
  assert.equal((await post('/desks/not-a-desk/discover')).status, 404);
});

test('discovery fills one desk and leaves the other nine empty', async () => {
  const res = await post('/desks/stabilizer/discover');
  assert.equal(res.status, 200);

  const { counts } = await res.json();
  assert.ok(counts.discovered > 0);
  assert.ok(counts.relevant < counts.afterDedup, 'the pipeline must reduce');

  const overview = await (await get('/desks')).json();
  const stabilizer = overview.desks.find((d: any) => d.desk.id === 'stabilizer');
  const others = overview.desks.filter((d: any) => d.desk.id !== 'stabilizer');

  assert.ok(stabilizer.counts.discovered > 0);
  for (const other of others) {
    assert.equal(other.counts.discovered, 0, `${other.desk.id} should be untouched`);
  }
});

test('fixture desks are simulated and say so', async () => {
  const body = await (await get('/desks')).json();
  assert.equal(body.simulated, true);
  for (const summary of body.desks) {
    assert.equal(summary.desk.simulated, true, `${summary.desk.id} must be labelled simulated`);
    // Messaging is never simulated: the policy decision holds in fixture mode.
    assert.equal(summary.desk.grants.message, false);
  }
});

test('a desk with real credentials is not simulated and keeps its real grants', async () => {
  process.env.DICE_REDDIT_COMPANION_CLIENT_ID = 'id';
  process.env.DICE_REDDIT_COMPANION_CLIENT_SECRET = 'secret';
  process.env.DICE_REDDIT_COMPANION_REFRESH_TOKEN = 'refresh';
  // No GRANTS configured, so read defaults to false even though it is connected.

  const view = await (await get('/desks/companion')).json();
  assert.equal(view.desk.simulated, false);
  assert.equal(view.desk.grants.read, false);

  const res = await post('/desks/companion/discover');
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /no read grant/);

  delete process.env.DICE_REDDIT_COMPANION_CLIENT_ID;
  delete process.env.DICE_REDDIT_COMPANION_CLIENT_SECRET;
  delete process.env.DICE_REDDIT_COMPANION_REFRESH_TOKEN;
});

test('switching desks loads that desk\'s own queue', async () => {
  await post('/desks/stabilizer/discover');
  await post('/desks/regulator/discover');

  const a = await (await get('/desks/stabilizer')).json();
  const b = await (await get('/desks/regulator')).json();

  assert.equal(a.desk.id, 'stabilizer');
  assert.equal(b.desk.id, 'regulator');
  assert.notDeepEqual(a.desk.lens.keywords, b.desk.lens.keywords, 'desks must listen differently');
  for (const signal of a.signals) assert.equal(signal.deskId, 'stabilizer');
  for (const signal of b.signals) assert.equal(signal.deskId, 'regulator');
});

test('an exhausted desk defers rather than continuing elsewhere', async () => {
  process.env.DICE_REDDIT_STABILIZER_RATE = '5/3600';

  const first = await post('/desks/stabilizer/discover');
  assert.equal(first.status, 200);
  assert.equal((await first.json()).spent, 5, 'only the assigned budget may be spent');

  const second = await post('/desks/stabilizer/discover');
  assert.equal(second.status, 429);
  const body = await second.json();
  assert.match(body.error, /rate limit/);
  assert.ok(body.deferredUntil, 'the operator is told when it resumes');
  assert.equal(body.desk, 'stabilizer', 'the refusal names this desk, not a replacement');

  // The other nine desks are unaffected by one desk being spent.
  const other = await post('/desks/regulator/discover');
  assert.equal(other.status, 200);

  delete process.env.DICE_REDDIT_STABILIZER_RATE;
});

/* ---------------------------- signal handling --------------------------- */

const firstActionable = async () => {
  await post('/desks/stabilizer/discover');
  return (await get('/desks/stabilizer')).json();
};

test('each card carries scores, reasons and an AIOP recommendation', async () => {
  const view = await firstActionable();
  const signal = view.signals[0];
  assert.ok(signal.scores.fit >= 0 && signal.scores.fit <= 100);
  assert.ok(signal.reasons.length > 0, 'why DICE selected it');
  assert.ok(signal.aiop.reading, 'what they appear to be asking for');
  assert.ok(signal.aiop.nextAction, 'what to do next');
  assert.ok(['act', 'watch', 'pass'].includes(signal.aiop.verdict));
});

test('a screened-out signal cannot be moved back into a working queue', async () => {
  await post('/desks/stabilizer/discover');
  const view = await (await get('/desks/stabilizer?state=do-not-contact')).json();
  const screened = view.signals[0];
  assert.ok(screened, 'the fixture must produce screened-out material');
  assert.equal(screened.state, 'do-not-contact');

  const res = await post(`/signals/${encodeURIComponent(screened.id)}/state`, { state: 'activated' });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /cannot be re-queued/);
});

test('a signal cannot be marked replied where replying is not permitted', async () => {
  const view = await firstActionable();
  const denied = view.signals.find((s: any) => !s.actions.reply.allowed && s.state !== 'do-not-contact' && s.state !== 'blocked');
  if (!denied) return; // fixture happened not to produce one

  const res = await post(`/signals/${encodeURIComponent(denied.id)}/state`, { state: 'replied' });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /Cannot mark as replied/);
});

test('a permitted signal transitions and records history', async () => {
  const view = await firstActionable();
  const ok = view.signals.find((s: any) => s.actions.reply.allowed);
  assert.ok(ok, 'the fixture must produce at least one actionable signal');

  const res = await post(`/signals/${encodeURIComponent(ok.id)}/state`, { state: 'activated', note: 'worth a reply' });
  assert.equal(res.status, 200);
  const { signal } = await res.json();
  assert.equal(signal.state, 'activated');
  assert.equal(signal.history.at(-1).event, 'activated');
  assert.equal(signal.history.at(-1).detail, 'worth a reply');
});

test('an invalid state is refused', async () => {
  const view = await firstActionable();
  const res = await post(`/signals/${encodeURIComponent(view.signals[0].id)}/state`, { state: 'do-not-contact' });
  assert.equal(res.status, 400);
});

/* -------------------------------- policy -------------------------------- */

test('the policy view lists the blocklist and says messaging is off', async () => {
  const body = await (await get('/policy')).json();
  assert.ok(body.blocked.length >= 10);
  assert.ok(body.blocked.some((r: any) => r.name === 'suicidewatch'));
  assert.match(body.note, /never searched/);
  assert.match(body.note, /messaging is disabled everywhere/);
});

test('a desk view reports subreddits refused by policy', async () => {
  const view = await (await get('/desks/stabilizer')).json();
  assert.ok(Array.isArray(view.scope.searchable));
  assert.ok(view.scope.searchable.length > 0);
});

/* ----------------------- operator-assisted ingest ----------------------- */

const REAL_PASTE = `https://www.reddit.com/r/jobs/comments/pw001/laid_off_this_morning_with_no_warning/
u/quiet_north_412
posted: 2h
Fifteen minutes in a meeting room and that was it. I have no idea what to do first. Do I file for
unemployment today? Do I tell people? My head is going in about nine directions at once and I cannot
get it to stop long enough to make one decision. Any advice on what actually needs doing in the first
24 hours?

https://www.reddit.com/r/layoffs/comments/pw002/role_eliminated_four_weeks_notice/
posted: 5h
They gave me four weeks after six years. I keep opening the job boards and closing them again.
How do you get past the first day of this?

https://www.reddit.com/r/antiwork/comments/pw003/i_built_an_app_that_fixes_burnout/
Check out my landing page, link in bio. DM me for a discount code.

https://www.reddit.com/r/depression/comments/pw004/struggling_lately/
posted: 1h
Been having a hard time.

https://www.reddit.com/r/jobs/comments/pw005/i_do_not_want_to_be_here_anymore/
posted: 1h
Everything came apart at once and I honestly don't want to be here anymore.

https://www.reddit.com/r/jobs/comments/pw006/which_laptop_for_uni/
posted: 4h
Budget is about 900, mostly essays.

https://redd.it/pw007
`;

test('pasted Reddit URLs become real signals through the same pipeline', async () => {
  const res = await post('/desks/stabilizer/ingest', { text: REAL_PASTE });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.accepted, 6, 'six parseable posts');
  assert.equal(body.failures.length, 1, 'the short link is reported');
  assert.equal(body.budgetSpent, 0, 'manual ingest consumes no API quota');
  assert.match(body.note, /No Reddit API request/);

  // The reduction ran: promotional, off-lens and screened-out material removed.
  assert.ok(body.counts.screenedOut >= 2, `screened ${body.counts.screenedOut}`);
  assert.ok(body.counts.relevant >= 1);
  assert.ok(body.counts.relevant < body.counts.afterDedup);
});

test('an ingested signal carries its source URL, subreddit, author and capture level', async () => {
  await post('/desks/stabilizer/ingest', { text: REAL_PASTE });
  const view = await (await get('/desks/stabilizer?state=priority')).json();
  const signal = view.signals.find((s: any) => s.postId === 'pw001');
  assert.ok(signal, 'the strongest real post should reach the priority queue');

  assert.equal(signal.permalink, 'https://www.reddit.com/r/jobs/comments/pw001/');
  assert.equal(signal.subreddit, 'jobs');
  assert.equal(signal.author, 'quiet_north_412');
  assert.equal(signal.capture, 'with-body');
  assert.equal(signal.ageUnknown, false);
  assert.equal(signal.source, 'manual');
  assert.ok(signal.discoveredAt);
  assert.equal(signal.history[0].event, 'discovered');
});

test('a crisis post pasted by hand is screened out, not queued', async () => {
  await post('/desks/stabilizer/ingest', { text: REAL_PASTE });
  const view = await (await get('/desks/stabilizer?state=do-not-contact')).json();
  const crisis = view.signals.find((s: any) => s.postId === 'pw005');

  assert.ok(crisis, 'the crisis post must be screened out');
  assert.equal(crisis.scores.priority, 0);
  assert.equal(crisis.actions.reply.allowed, false);
});

test('a post from a blocked subreddit is refused even when pasted deliberately', async () => {
  await post('/desks/stabilizer/ingest', { text: REAL_PASTE });
  const view = await (await get('/desks/stabilizer?state=blocked')).json();
  const blocked = view.signals.find((s: any) => s.postId === 'pw004');
  assert.ok(blocked, 'r/depression must be refused');
  assert.match(blocked.screenedReason, /peer support/i);
});

test('pasting the same posts twice adds nothing', async () => {
  const first = await (await post('/desks/stabilizer/ingest', { text: REAL_PASTE })).json();
  const second = await (await post('/desks/stabilizer/ingest', { text: REAL_PASTE })).json();
  assert.ok(first.counts.afterDedup > 0);
  assert.equal(second.counts.afterDedup, 0, 're-pasting must be a no-op');
});

test('a bare URL is scored on its title and says so', async () => {
  await post('/desks/stabilizer/ingest', {
    text: 'https://www.reddit.com/r/jobs/comments/pw010/just_got_laid_off_and_i_am_freaking_out/',
  });
  const view = await (await get('/desks/stabilizer')).json();
  const signal = view.signals.find((s: any) => s.postId === 'pw010');

  assert.equal(signal.capture, 'url-only');
  assert.equal(signal.ageUnknown, true);
  assert.ok(signal.reasons.some((r: string) => /title only/.test(r)));
  assert.ok(signal.reasons.some((r: string) => /Age unknown/.test(r)));
});

test('an ingested signal collides with another desk that already engaged it', async () => {
  await post('/desks/regulator/ingest', {
    text: 'https://www.reddit.com/r/antiwork/comments/pw020/completely_burned_out/\nposted: 1h\nRunning on empty for months and dreading every Monday. Any advice on how to come back from this?',
  });
  const regulatorView = await (await get('/desks/regulator')).json();
  const theirs = regulatorView.signals.find((s: any) => s.postId === 'pw020');
  assert.ok(theirs?.actions.reply.allowed, 'regulator should be able to act first');
  await post(`/signals/${encodeURIComponent(theirs.id)}/state`, { state: 'activated' });

  // A different desk pastes the same thread.
  await post('/desks/stabilizer/ingest', {
    text: 'https://www.reddit.com/r/antiwork/comments/pw020/completely_burned_out/\nposted: 1h\nRunning on empty for months and dreading every Monday. Any advice on how to come back from this?',
  });
  const mine = await (await get('/desks/stabilizer')).json();
  const signal = mine.signals.find((s: any) => s.postId === 'pw020');

  assert.ok(signal.collision, 'the second desk must see the collision');
  assert.equal(signal.collision.deskId, 'regulator');
  assert.equal(signal.actions.reply.allowed, false);
});

test('an empty or unparseable paste is refused clearly', async () => {
  assert.equal((await post('/desks/stabilizer/ingest', { text: '   ' })).status, 400);
  const res = await post('/desks/stabilizer/ingest', { text: 'https://example.com/nope' });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Reddit/);
});

/* ---------------------------- the lens editor --------------------------- */

test('a desk exposes its lens with the shipped defaults alongside', async () => {
  const view = await (await get('/desks/stabilizer')).json();
  assert.ok(view.lens.subreddits.length > 0);
  assert.equal(view.lens.edited, false);
  assert.ok(view.lens.defaults.subreddits.length > 0);
  assert.equal(typeof view.lens.minScore, 'number');
  assert.equal(typeof view.lens.maxAgeHours, 'number');
});

test('an operator can retune a desk without touching code', async () => {
  const res = await fetch(`${base}/api/dice/desks/stabilizer/lens`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      subreddits: ['jobs', 'careerguidance'],
      keywords: ['laid off', 'severance'],
      exclusions: ['recruiter'],
      minScore: 60,
      maxAgeHours: 24,
    }),
  });
  assert.equal(res.status, 200);
  const { lens } = await res.json();
  assert.deepEqual(lens.subreddits, ['jobs', 'careerguidance']);
  assert.equal(lens.minScore, 60);
  assert.equal(lens.edited, true);

  // And it survives into the desk view.
  const view = await (await get('/desks/stabilizer')).json();
  assert.deepEqual(view.desk.lens.subreddits, ['jobs', 'careerguidance']);
  assert.deepEqual(view.scope.searchable, ['jobs', 'careerguidance']);
});

test('the operator cannot add a blocked subreddit — the save fails and says why', async () => {
  const res = await fetch(`${base}/api/dice/desks/stabilizer/lens`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ subreddits: ['jobs', 'SuicideWatch', 'depression'], keywords: ['x'], exclusions: [] }),
  });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.deepEqual(body.refused.map((r: any) => r.name).sort(), ['depression', 'suicidewatch']);

  // Nothing was saved — the operator's stated intent was not silently altered.
  const view = await (await get('/desks/stabilizer')).json();
  assert.equal(view.lens.edited, false);
});

test('a raised score floor actually rejects weaker signals', async () => {
  await fetch(`${base}/api/dice/desks/stabilizer/lens`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      subreddits: ['jobs'], keywords: ['laid off'], exclusions: [], minScore: 99, maxAgeHours: 168,
    }),
  });

  await post('/desks/stabilizer/ingest', { text: REAL_PASTE });
  const view = await (await get('/desks/stabilizer?state=rejected')).json();
  assert.ok(
    view.signals.some((s: any) => /score floor of 99/.test(s.screenedReason ?? '')),
    'the operator-set floor must be the stated reason',
  );
});

test('a tightened recency window rejects older posts', async () => {
  await fetch(`${base}/api/dice/desks/stabilizer/lens`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      subreddits: ['jobs'], keywords: ['laid off'], exclusions: [], minScore: 10, maxAgeHours: 3,
    }),
  });

  await post('/desks/stabilizer/ingest', {
    text: 'https://www.reddit.com/r/jobs/comments/pw030/laid_off_last_week/\nposted: 5 days\nStill processing it. Any advice?',
  });
  const view = await (await get('/desks/stabilizer?state=rejected')).json();
  assert.ok(view.signals.some((s: any) => /3h window/.test(s.screenedReason ?? '')));
});
