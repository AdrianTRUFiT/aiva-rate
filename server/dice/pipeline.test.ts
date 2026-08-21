import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from './pipeline';
import { buildIndex, emptyIndex } from './collision';
import { buildDesk } from './accounts';
import { FixtureSignalSource } from './sources/fixture';
import { searchableSubreddits } from './policy';
import type { Desk, RawSignal, Signal } from './types';

const NOW = new Date('2026-03-02T12:00:00.000Z');

const desk = (): Desk => ({
  ...buildDesk('stabilizer'),
  auth: 'connected',
  grants: { read: true, comment: true, message: false },
});

const raw = (over: Partial<RawSignal> = {}): RawSignal => ({
  sourceId: 'fixture:stabilizer:1',
  subreddit: 'jobs',
  postId: `p${Math.random()}`,
  author: 'a_person',
  title: 'Got laid off this morning with no warning',
  body: 'Fifteen minutes and that was it. My head is going in nine directions. Any advice on what actually needs doing first? I have a mortgage and I am the only earner and I cannot get my brain to settle long enough to pick one thing.',
  permalink: 'https://reddit.com/r/jobs/comments/x',
  createdAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
  ...over,
});

const run = (items: RawSignal[], index = emptyIndex(), known = new Set<string>()) =>
  runPipeline({ desk: desk(), raw: items, index, known, now: NOW });

test('an on-lens, recent, asking post reaches the priority queue', () => {
  const { signals, counts } = run([raw()]);
  assert.equal(counts.priorityToday, 1);
  assert.equal(signals[0].state, 'priority');
  assert.ok(signals[0].scores.fit > 60, `fit was ${signals[0].scores.fit}`);
  assert.ok(signals[0].reasons.length > 0, 'the operator must be told why');
});

test('duplicates collapse, within a run and against the stored queue', () => {
  const item = raw({ postId: 'same' });
  assert.equal(run([item, item, item]).counts.afterDedup, 1);

  const known = new Set(['jobs:same']);
  assert.equal(run([item], emptyIndex(), known).counts.afterDedup, 0);
});

test('promotional posts are rejected outright, not ranked low', () => {
  const { signals } = run([raw({
    title: 'I built an app that fixes burnout',
    body: 'Check out my landing page, link in bio. DM me for a discount code.',
  })]);
  assert.equal(signals[0].state, 'rejected');
  assert.match(signals[0].screenedReason ?? '', /Promotional/);
});

test('a crisis post is screened out with no score and no actions', () => {
  const { signals, counts } = run([raw({
    title: 'I cannot keep doing this',
    body: "Everything came apart and I don't want to be here anymore.",
  })]);
  assert.equal(counts.screenedOut, 1);
  assert.equal(counts.priorityToday, 0);
  assert.equal(signals[0].state, 'do-not-contact');
  assert.equal(signals[0].scores.priority, 0, 'a crisis post must never carry a priority score');
  assert.equal(signals[0].actions.reply.allowed, false);
  assert.equal(signals[0].actions.message.allowed, false);
});

test('a post from a blocked subreddit is screened out even if it scores well', () => {
  const { signals, counts } = run([raw({ subreddit: 'depression' })]);
  assert.equal(counts.screenedOut, 1);
  assert.equal(signals[0].state, 'blocked');
  assert.equal(signals[0].scores.priority, 0);
});

test('stale posts fall below the priority bar', () => {
  const old = raw({ createdAt: new Date(NOW.getTime() - 6 * 86_400_000).toISOString() });
  const { signals } = run([old]);
  assert.notEqual(signals[0].state, 'priority');
  assert.ok(signals[0].reasons.some((r) => /days old/.test(r)));
});

test('a colliding signal is kept out of the priority queue', () => {
  const item = raw({ author: 'shared_person', postId: 'shared1' });
  const other: Signal = {
    id: 'regulator:jobs:shared1', deskId: 'regulator', source: 'fixture',
    subreddit: 'jobs', postId: 'shared1', author: 'shared_person',
    title: '', excerpt: '', permalink: '', createdAt: item.createdAt,
    discoveredAt: item.createdAt, scores: { fit: 0, intent: 0, freshnessHours: 0, priority: 0 },
    reasons: [], state: 'replied', screenedReason: null, capture: 'source', ageUnknown: false,
    actions: { reply: { allowed: true, reason: '' }, message: { allowed: false, reason: '' } },
    collision: null, history: [{ at: item.createdAt, event: 'replied' }],
  };

  const { signals, counts } = run([item], buildIndex([other]));
  assert.equal(counts.priorityToday, 0, 'a collision must not surface as today\'s work');
  assert.ok(signals[0].collision);
  assert.equal(signals[0].actions.reply.allowed, false);
});

test('signals come back ordered by priority', () => {
  const { signals } = run([
    raw({ postId: 'stale', createdAt: new Date(NOW.getTime() - 8 * 86_400_000).toISOString() }),
    raw({ postId: 'fresh' }),
  ]);
  assert.ok(signals[0].scores.priority >= signals[1].scores.priority);
});

test('only an excerpt is stored — DICE does not warehouse full posts', () => {
  const { signals } = run([raw({ body: 'x'.repeat(2000) })]);
  assert.ok(signals[0].excerpt.length <= 601);
  assert.ok(signals[0].excerpt.endsWith('…'));
});

test('a real fixture pool reduces from hundreds to a workable day', async () => {
  const d = desk();
  const scope = searchableSubreddits(d);
  const result = await new FixtureSignalSource().discover({
    desk: d, subreddits: scope.allowed, budget: 500, now: NOW,
  });

  const { counts } = runPipeline({
    desk: d, raw: result.signals, index: emptyIndex(), known: new Set(), now: NOW,
  });

  assert.ok(counts.discovered > 300, `discovered ${counts.discovered}`);
  assert.ok(counts.relevant < counts.afterDedup, 'relevant must be a real reduction');
  assert.ok(counts.strong <= counts.relevant);
  assert.ok(counts.priorityToday <= counts.strong);
  assert.ok(counts.priorityToday > 0, 'the reduction must not empty the queue');
  assert.ok(counts.priorityToday < 60, `priority queue was ${counts.priorityToday} — too many to work`);
  assert.ok(counts.screenedOut > 0, 'the fixture includes material that must be screened out');
});
