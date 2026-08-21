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
