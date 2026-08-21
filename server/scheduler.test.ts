import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryEnrollmentRepository } from './store/fileStore';
import { setMailer } from './mail';
import { safetyPause, sweep } from './scheduler';
import { PLAN_LENGTH } from './delivery';
import type { Mailer, OutboundMessage, SentMessage } from './mail/types';
import type { Enrollment } from './store/types';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-03-01T09:00:00.000Z');
const at = (days: number) => new Date(T0.getTime() + days * DAY);

let repo: MemoryEnrollmentRepository;
let sent: OutboundMessage[];
let failNext = 0;

class TestMailer implements Mailer {
  readonly name = 'file' as const;
  async send(message: OutboundMessage): Promise<SentMessage> {
    if (failNext > 0) {
      failNext--;
      throw new Error('simulated mail failure');
    }
    sent.push(message);
    return { messageId: `m_${sent.length}`, channel: 'email' };
  }
}

const active = (over: Partial<Enrollment> = {}): Enrollment => ({
  id: 'enr_sweep',
  createdAt: T0.toISOString(),
  pressure: 'racing-thoughts',
  entryPersona: 'unraveler',
  entryIntervention: 'thread-extraction',
  email: 'person@example.com',
  status: 'active',
  payment: { provider: 'mock', checkoutId: 'cs', paidAt: T0.toISOString(), amountCents: 2900, currency: 'usd' },
  startedAt: T0.toISOString(),
  days: [],
  deliveries: [],
  resumeTokenHash: 'h',
  safety: null,
  ...over,
});

beforeEach(() => {
  repo = new MemoryEnrollmentRepository();
  sent = [];
  failNext = 0;
  setMailer(new TestMailer());
});

after(() => setMailer(null));

test('a sweep sends exactly one message per unlocked day', async () => {
  await repo.create(active());
  assert.equal((await sweep(repo, () => T0)).length, 1);
  assert.equal((await sweep(repo, () => at(1))).length, 1);
  assert.equal(sent.length, 2);
  assert.match(sent[0].subject, /Day 1/);
  assert.match(sent[1].subject, /Day 2/);
});

test('repeated sweeps at the same time send nothing further', async () => {
  await repo.create(active());
  await sweep(repo, () => T0);
  await sweep(repo, () => T0);
  await sweep(repo, () => T0);
  assert.equal(sent.length, 1);
});

test('the whole week delivers once each and then completes', async () => {
  await repo.create(active());
  for (let d = 0; d < PLAN_LENGTH; d++) await sweep(repo, () => at(d));

  assert.equal(sent.length, PLAN_LENGTH);
  assert.deepEqual(
    sent.map((m) => m.subject.match(/Day (\d)/)?.[1]),
    ['1', '2', '3', '4', '5', '6', '7'],
  );
  assert.equal((await repo.get('enr_sweep'))?.status, 'completed');
  // A completed week keeps sending nothing.
  await sweep(repo, () => at(30));
  assert.equal(sent.length, PLAN_LENGTH);
});

test('the final day says the week is ending', async () => {
  await repo.create(active());
  for (let d = 0; d < PLAN_LENGTH; d++) await sweep(repo, () => at(d));
  const last = sent[PLAN_LENGTH - 1];
  assert.match(last.subject, /the last one/);
  assert.match(last.text, /nothing renews/i);
});

test('a delivery failure leaves the day pending for the next sweep', async () => {
  await repo.create(active());
  failNext = 1;
  assert.equal((await sweep(repo, () => T0)).length, 0);
  assert.equal((await repo.get('enr_sweep'))!.deliveries.length, 0, 'a failed send must not be recorded');

  const retried = await sweep(repo, () => T0);
  assert.equal(retried.length, 1);
  assert.equal(sent.length, 1);
});

test('one bad address does not stall the sweep for everyone else', async () => {
  await repo.create(active({ id: 'enr_bad' }));
  await repo.create(active({ id: 'enr_good', email: 'other@example.com' }));
  failNext = 1;

  const result = await sweep(repo, () => T0);
  assert.equal(result.length, 1, 'the healthy enrolment still got its day');
  assert.equal(result[0].enrollmentId, 'enr_good');
});

test('idempotency keys are unique per enrolment and day', async () => {
  await repo.create(active({ id: 'enr_1' }));
  await repo.create(active({ id: 'enr_2', email: 'two@example.com' }));
  await sweep(repo, () => T0);
  await sweep(repo, () => at(1));

  const keys = sent.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys.sort(), ['enr_1-day-1', 'enr_1-day-2', 'enr_2-day-1', 'enr_2-day-2']);
});

test('a safety pause stops delivery immediately and permanently', async () => {
  await repo.create(active());
  await sweep(repo, () => T0);
  assert.equal(sent.length, 1);

  await safetyPause(repo, 'enr_sweep', ['self-harm'], () => at(0));

  await sweep(repo, () => at(1));
  await sweep(repo, () => at(2));
  assert.equal(sent.length, 1, 'nothing further may be pushed after a pause');
  assert.equal((await repo.get('enr_sweep'))?.status, 'paused_safety');
});

test('a returning person away for three days gets the days they missed', async () => {
  await repo.create(active());
  const result = await sweep(repo, () => at(2));
  assert.deepEqual(result.map((r) => r.day), [1, 2, 3]);
});
