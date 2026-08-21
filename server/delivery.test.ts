import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_LENGTH,
  currentDay,
  isComplete,
  pendingDeliveries,
  resumeView,
  unlocksAt,
} from './delivery';
import type { Enrollment } from './store/types';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-03-01T09:00:00.000Z');
const at = (days: number, hours = 0) => new Date(T0.getTime() + days * DAY + hours * 3600_000);

const enrollment = (over: Partial<Enrollment> = {}): Enrollment => ({
  id: 'enr_test',
  createdAt: T0.toISOString(),
  pressure: 'sudden-shock',
  entryPersona: 'stabilizer',
  entryIntervention: 'stabilize-90',
  email: 'person@example.com',
  status: 'active',
  payment: { provider: 'mock', checkoutId: 'cs_1', paidAt: T0.toISOString(), amountCents: 2900, currency: 'usd' },
  startedAt: T0.toISOString(),
  days: [],
  deliveries: [],
  resumeTokenHash: 'x',
  safety: null,
  ...over,
});

test('day 1 is available the moment payment confirms', () => {
  assert.equal(currentDay(enrollment(), T0), 1);
});

test('day 2 unlocks exactly 24 hours later, not before', () => {
  assert.equal(currentDay(enrollment(), at(0, 23)), 1);
  assert.equal(currentDay(enrollment(), at(1)), 2);
});

test('the plan never runs past seven days however long someone is away', () => {
  assert.equal(currentDay(enrollment(), at(6)), PLAN_LENGTH);
  assert.equal(currentDay(enrollment(), at(400)), PLAN_LENGTH);
});

test('an unstarted enrolment has no current day', () => {
  assert.equal(currentDay(enrollment({ startedAt: null }), T0), null);
});

test('clock skew never hides day 1', () => {
  assert.equal(currentDay(enrollment(), new Date(T0.getTime() - 60_000)), 1);
});

test('a missed day is still delivered rather than skipped', () => {
  // Away for three days, having received nothing: all three are owed.
  assert.deepEqual(pendingDeliveries(enrollment(), at(2)), [1, 2, 3]);
});

test('delivery is idempotent — an already-sent day is never re-sent', () => {
  const e = enrollment({
    deliveries: [{ day: 1, sentAt: T0.toISOString(), channel: 'email', messageId: 'm1' }],
  });
  assert.deepEqual(pendingDeliveries(e, T0), []);
  assert.deepEqual(pendingDeliveries(e, at(1)), [2]);
});

test('nothing is delivered to a paused or unpaid enrolment', () => {
  for (const status of ['pending_payment', 'paused_safety', 'cancelled', 'completed'] as const) {
    assert.deepEqual(pendingDeliveries(enrollment({ status }), at(3)), [], status);
  }
});

test('missing a day does not block the next one', () => {
  // Day 1 delivered and never completed; day 2 still unlocks on schedule.
  const e = enrollment({
    deliveries: [{ day: 1, sentAt: T0.toISOString(), channel: 'email', messageId: 'm1' }],
    days: [{ day: 1, completedAt: null, note: null, rating: null }],
  });
  assert.deepEqual(pendingDeliveries(e, at(1)), [2]);
});

test('completion needs both the last day unlocked and every day delivered', () => {
  const all = Array.from({ length: PLAN_LENGTH }, (_, i) => ({
    day: i + 1,
    sentAt: T0.toISOString(),
    channel: 'email' as const,
    messageId: `m${i}`,
  }));
  assert.equal(isComplete(enrollment({ deliveries: all }), at(6)), true);
  assert.equal(isComplete(enrollment({ deliveries: all.slice(0, 6) }), at(6)), false);
  assert.equal(isComplete(enrollment({ deliveries: all }), at(5)), false);
});

test('unlock times are 24 hours apart from the start', () => {
  assert.equal(unlocksAt(enrollment(), 1)?.toISOString(), T0.toISOString());
  assert.equal(unlocksAt(enrollment(), 3)?.toISOString(), at(2).toISOString());
  assert.equal(unlocksAt(enrollment({ startedAt: null }), 2), null);
});

test('the resume view locks future days and reports when the next one opens', () => {
  const view = resumeView(enrollment(), at(1));
  assert.equal(view.currentDay, 2);
  assert.equal(view.plan.length, PLAN_LENGTH);
  assert.equal(view.plan.filter((d) => !d.locked).length, 2);
  assert.equal(view.nextUnlocksAt, at(2).toISOString());
});

test('the resume view has no next unlock on the final day', () => {
  assert.equal(resumeView(enrollment(), at(6)).nextUnlocksAt, null);
});

test('the resume view reports which days were actually completed', () => {
  const e = enrollment({
    days: [
      { day: 1, completedAt: T0.toISOString(), note: 'slept badly', rating: 4 },
      { day: 2, completedAt: null, note: null, rating: null },
    ],
  });
  assert.deepEqual(resumeView(e, at(2)).completedDays, [1]);
});

test('the resume view carries server time so clients need not trust their own', () => {
  const at3 = at(3);
  assert.equal(resumeView(enrollment(), at3).now, at3.toISOString());
});
