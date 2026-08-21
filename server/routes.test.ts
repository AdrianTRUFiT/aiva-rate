import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildRoutes } from './routes';
import { MemoryEnrollmentRepository } from './store/fileStore';
import { setMailer } from './mail';
import { MockCheckoutProvider } from './payments/mock';
import { hashToken } from './identity';
import type { EnrollRequest } from './api';
import type { Mailer, OutboundMessage, SentMessage } from './mail/types';

/**
 * The server-side half of the offer gate and the safety precedence.
 *
 * The browser already refuses to show an offer that was not earned. These
 * tests cover the case that actually matters commercially: a request arriving
 * at the money-taking endpoint claiming an offer it did not earn.
 */

const SECRET = 'test-secret';
const DAY = 24 * 60 * 60 * 1000;
let now = new Date('2026-03-01T09:00:00.000Z');

let repo: MemoryEnrollmentRepository;
let sent: OutboundMessage[];
let server: ReturnType<express.Express['listen']>;
let base: string;

class CapturingMailer implements Mailer {
  readonly name = 'file' as const;
  async send(message: OutboundMessage): Promise<SentMessage> {
    sent.push(message);
    return { messageId: `m_${sent.length}`, channel: 'email' };
  }
}

const payments = new MockCheckoutProvider(SECRET, 'http://localhost');

const start = async () => {
  const app = express();
  app.use('/api', buildRoutes({ repo, payments, clock: () => now, devSecret: SECRET }));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

beforeEach(async () => {
  now = new Date('2026-03-01T09:00:00.000Z');
  repo = new MemoryEnrollmentRepository();
  sent = [];
  setMailer(new CapturingMailer());
  if (server) await new Promise((r) => server.close(r));
  await start();
});

after(async () => {
  setMailer(null);
  if (server) await new Promise((r) => server.close(r));
});

const earned: EnrollRequest = {
  email: 'person@example.com',
  pressure: 'sudden-shock',
  persona: 'stabilizer',
  intervention: 'stabilize-90',
  evidence: { interventionCompleted: true, shift: 'shifted', attempts: 1, safetyRouted: false },
};

const enroll = (body: unknown) =>
  fetch(`${base}/api/enroll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const confirmPayment = async (enrollmentId: string, checkoutId: string) => {
  const raw = Buffer.from(
    JSON.stringify({ id: `evt_${Date.now()}`, type: 'payment.completed', checkoutId, enrollmentId }),
    'utf8',
  );
  return fetch(`${base}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mock-signature': payments.sign(raw) },
    body: raw,
  });
};

/* --------------------------------- gate --------------------------------- */

test('an earned offer enrols and returns a checkout url', async () => {
  const res = await enroll(earned);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.enrollmentId, /^enr_/);
  assert.ok(body.checkoutUrl.includes(body.enrollmentId));
  // The resume cookie is set at enrolment, before payment.
  assert.match(res.headers.get('set-cookie') ?? '', /pw_resume=.*HttpOnly/);
});

test('an unearned offer is refused at the money-taking endpoint', async () => {
  for (const evidence of [
    { interventionCompleted: false, shift: 'shifted', attempts: 1, safetyRouted: false },
    { interventionCompleted: true, shift: null, attempts: 1, safetyRouted: false },
    { interventionCompleted: true, shift: 'unchanged', attempts: 1, safetyRouted: false },
    { interventionCompleted: true, shift: 'worse', attempts: 1, safetyRouted: false },
  ] as const) {
    const res = await enroll({ ...earned, evidence });
    assert.equal(res.status, 403, JSON.stringify(evidence));
    assert.ok((await res.json()).gate, 'the refusal should say which rule refused it');
  }
});

test('a safety-routed session cannot buy anything, whatever else it claims', async () => {
  const res = await enroll({
    ...earned,
    evidence: { interventionCompleted: true, shift: 'shifted', attempts: 1, safetyRouted: true },
  });
  assert.equal(res.status, 403);
  assert.match((await res.json()).gate, /crisis/i);
});

test('a refused enrolment creates nothing', async () => {
  await enroll({ ...earned, evidence: { ...earned.evidence, shift: 'worse' } });
  assert.deepEqual(await repo.active(), []);
});

test('unknown identifiers are rejected rather than reaching the plan builder', async () => {
  for (const patch of [
    { pressure: 'not-a-pressure' },
    { persona: 'not-a-guide' },
    { intervention: 'not-an-exercise' },
  ]) {
    assert.equal((await enroll({ ...earned, ...patch })).status, 400, JSON.stringify(patch));
  }
});

test('a malformed email is rejected before any charge is started', async () => {
  assert.equal((await enroll({ ...earned, email: 'nope' })).status, 400);
  assert.equal((await enroll({ ...earned, email: '' })).status, 400);
});

/* -------------------------------- payment ------------------------------- */

test('enrolment is not active until the webhook confirms it', async () => {
  const { enrollmentId } = await (await enroll(earned)).json();
  assert.equal((await repo.get(enrollmentId))?.status, 'pending_payment');
  assert.deepEqual(sent, [], 'nothing should be emailed before payment');
});

test('a confirmed payment activates the week and sends welcome plus day 1', async () => {
  const { enrollmentId } = await (await enroll(earned)).json();
  const enrollment = await repo.get(enrollmentId);

  const res = await confirmPayment(enrollmentId, enrollment!.payment.checkoutId!);
  assert.equal(res.status, 200);

  const active = await repo.get(enrollmentId);
  assert.equal(active?.status, 'active');
  assert.equal(active?.startedAt, now.toISOString());
  assert.equal(sent.length, 2);
  assert.match(sent[0].subject, /your link/);
  assert.match(sent[1].subject, /Day 1/);
});

test('a replayed webhook does not re-send or re-start the week', async () => {
  const { enrollmentId } = await (await enroll(earned)).json();
  const checkoutId = (await repo.get(enrollmentId))!.payment.checkoutId!;

  await confirmPayment(enrollmentId, checkoutId);
  const startedAt = (await repo.get(enrollmentId))!.startedAt;
  const afterFirst = sent.length;

  const replay = await confirmPayment(enrollmentId, checkoutId);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).alreadyProcessed, true);
  assert.equal(sent.length, afterFirst, 'a replay must not re-send');
  assert.equal((await repo.get(enrollmentId))!.startedAt, startedAt);
});

test('an unsigned webhook is rejected and confirms nothing', async () => {
  const { enrollmentId } = await (await enroll(earned)).json();
  const res = await fetch(`${base}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'evt_x', type: 'payment.completed', enrollmentId, checkoutId: 'cs' }),
  });
  assert.equal(res.status, 400);
  assert.equal((await repo.get(enrollmentId))?.status, 'pending_payment');
});

test('a webhook signed with the wrong secret is rejected', async () => {
  const { enrollmentId } = await (await enroll(earned)).json();
  const raw = Buffer.from(JSON.stringify({ id: 'e', type: 'payment.completed', enrollmentId, checkoutId: 'cs' }));
  const res = await fetch(`${base}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mock-signature': createHmac('sha256', 'wrong').update(raw).digest('hex'),
    },
    body: raw,
  });
  assert.equal(res.status, 400);
  assert.equal((await repo.get(enrollmentId))?.status, 'pending_payment');
});

/* --------------------------- resume and check-in ------------------------ */

const enrolAndPay = async () => {
  const res = await enroll(earned);
  const { enrollmentId } = await res.json();
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
  await confirmPayment(enrollmentId, (await repo.get(enrollmentId))!.payment.checkoutId!);
  return { enrollmentId, cookie };
};

test('a returning person is recognised by cookie and sees the right day', async () => {
  const { cookie } = await enrolAndPay();

  const day1 = await (await fetch(`${base}/api/session`, { headers: { cookie } })).json();
  assert.equal(day1.currentDay, 1);
  assert.equal(day1.plan.filter((d: { locked: boolean }) => !d.locked).length, 1);

  // Come back tomorrow.
  now = new Date(now.getTime() + DAY);
  const day2 = await (await fetch(`${base}/api/session`, { headers: { cookie } })).json();
  assert.equal(day2.currentDay, 2);
  assert.equal(day2.pressure, 'sudden-shock', 'context is preserved across the gap');
});

test('an emailed link resumes on a device with no cookie', async () => {
  await enrolAndPay();
  const enrollment = (await repo.active())[0];
  // Find the token by brute-force over what we issued: the cookie carried it.
  const res = await enroll({ ...earned, email: 'second@example.com' });
  const token = (res.headers.get('set-cookie') ?? '').split('=')[1].split(';')[0];
  assert.equal(hashToken(token), (await repo.get((await res.json()).enrollmentId))!.resumeTokenHash);

  // And the original still resolves only via its own token.
  const wrong = await fetch(`${base}/api/session?token=${token}`);
  assert.notEqual((await wrong.json()).enrollmentId, enrollment.id);
});

test('an unknown token gets no session and the stale cookie is cleared', async () => {
  const res = await fetch(`${base}/api/session?token=made-up`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('set-cookie') ?? '', /Max-Age=0/);
});

test('a check-in records the day and cannot reach a locked one', async () => {
  const { cookie, enrollmentId } = await enrolAndPay();

  const ok = await fetch(`${base}/api/checkin`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ day: 1, rating: 6, note: 'slept badly but got up' }),
  });
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).view.completedDays, [1]);

  const locked = await fetch(`${base}/api/checkin`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ day: 4, rating: 5, note: 'jumping ahead' }),
  });
  assert.equal(locked.status, 409);
  assert.deepEqual((await repo.get(enrollmentId))!.days.map((d) => d.day), [1]);
});

test('a check-in that trips the safety screen pauses delivery and sells nothing', async () => {
  const { cookie, enrollmentId } = await enrolAndPay();
  const before = sent.length;

  const res = await fetch(`${base}/api/checkin`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ day: 1, rating: 1, note: "I don't want to be here anymore" }),
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).routedToSupport, true);

  const paused = await repo.get(enrollmentId);
  assert.equal(paused?.status, 'paused_safety');
  assert.ok(paused?.safety?.categories.includes('self-harm'));

  // The only message that goes out is the pause notice, and it carries helplines.
  assert.equal(sent.length, before + 1);
  assert.match(sent[sent.length - 1].subject, /Pausing/);
  assert.match(sent[sent.length - 1].text, /988/);

  // The note itself is not stored — it routed instead of being logged.
  assert.deepEqual(paused?.days, []);
});

test('a paused week accepts no further check-ins', async () => {
  const { cookie } = await enrolAndPay();
  await fetch(`${base}/api/checkin`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ day: 1, rating: 1, note: 'I want to kill myself' }),
  });

  const again = await fetch(`${base}/api/checkin`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ day: 1, rating: 5, note: 'better now' }),
  });
  assert.equal(again.status, 409);
});

test('today returns the unlocked exercise and whether it was already logged', async () => {
  const { cookie } = await enrolAndPay();
  const first = await (await fetch(`${base}/api/today`, { headers: { cookie } })).json();
  assert.equal(first.day, 1);
  assert.equal(first.name, '90-second stabilization');
  assert.equal(first.alreadyLogged, false);
  assert.ok(first.steps.length >= 3);

  await fetch(`${base}/api/checkin`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ day: 1, rating: 7, note: 'ok' }),
  });
  assert.equal((await (await fetch(`${base}/api/today`, { headers: { cookie } })).json()).alreadyLogged, true);
});

test('no cookie means no session, no today, and no check-in', async () => {
  await enrolAndPay();
  assert.equal((await fetch(`${base}/api/session`)).status, 404);
  assert.equal((await fetch(`${base}/api/today`)).status, 404);
  assert.equal(
    (await fetch(`${base}/api/checkin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ day: 1, rating: 5, note: 'x' }),
    })).status,
    404,
  );
});
