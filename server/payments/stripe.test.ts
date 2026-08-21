import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { StripeCheckoutProvider, WEBHOOK_TOLERANCE_SECONDS, verifyStripeSignature } from './stripe';

const SECRET = 'whsec_testsecret';
const body = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8');

const sign = (raw: Buffer, t: number, secret = SECRET) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest('hex')}`;

const now = 1_800_000_000;

test('a correctly signed payload verifies', () => {
  const raw = body({ id: 'evt_1', type: 'checkout.session.completed' });
  assert.doesNotThrow(() => verifyStripeSignature(raw, sign(raw, now), SECRET, now));
});

test('a tampered payload is rejected', () => {
  const raw = body({ id: 'evt_1', type: 'checkout.session.completed' });
  const signature = sign(raw, now);
  const tampered = body({ id: 'evt_1', type: 'checkout.session.completed', extra: 'injected' });
  assert.throws(() => verifyStripeSignature(tampered, signature, SECRET, now), /mismatch/);
});

test('a signature from the wrong secret is rejected', () => {
  const raw = body({ id: 'evt_1' });
  assert.throws(
    () => verifyStripeSignature(raw, sign(raw, now, 'whsec_wrong'), SECRET, now),
    /mismatch/,
  );
});

test('a replayed signature outside the tolerance window is rejected', () => {
  const raw = body({ id: 'evt_1' });
  const old = now - WEBHOOK_TOLERANCE_SECONDS - 1;
  assert.throws(() => verifyStripeSignature(raw, sign(raw, old), SECRET, now), /tolerance/);
  // Just inside the window still passes.
  const recent = now - WEBHOOK_TOLERANCE_SECONDS + 1;
  assert.doesNotThrow(() => verifyStripeSignature(raw, sign(raw, recent), SECRET, now));
});

test('malformed signature headers are rejected, not ignored', () => {
  const raw = body({ id: 'evt_1' });
  assert.throws(() => verifyStripeSignature(raw, '', SECRET, now), /timestamp/);
  assert.throws(() => verifyStripeSignature(raw, `t=${now}`, SECRET, now), /no v1/);
  assert.throws(() => verifyStripeSignature(raw, `t=abc,v1=ff`, SECRET, now), /timestamp/);
  assert.throws(() => verifyStripeSignature(raw, `t=${now},v1=zzz`, SECRET, now), /mismatch/);
});

test('a completed checkout maps to a payment event carrying the enrolment', () => {
  const provider = new StripeCheckoutProvider('sk_test_x', SECRET);
  const raw = body({
    id: 'evt_2',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', client_reference_id: 'enr_abc' } },
  });
  const t = Math.floor(Date.now() / 1000);
  const event = provider.parseWebhook(raw, { 'stripe-signature': sign(raw, t) });

  assert.equal(event.type, 'payment.completed');
  assert.equal(event.checkoutId, 'cs_test_1');
  assert.equal(event.enrollmentId, 'enr_abc');
  assert.equal(event.eventId, 'evt_2');
});

test('the enrolment id falls back to metadata when there is no client reference', () => {
  const provider = new StripeCheckoutProvider('sk_test_x', SECRET);
  const raw = body({
    id: 'evt_3',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_2', metadata: { enrollment_id: 'enr_meta' } } },
  });
  const t = Math.floor(Date.now() / 1000);
  assert.equal(provider.parseWebhook(raw, { 'stripe-signature': sign(raw, t) }).enrollmentId, 'enr_meta');
});

test('unrelated stripe events are ignored rather than misread as payment', () => {
  const provider = new StripeCheckoutProvider('sk_test_x', SECRET);
  const raw = body({
    id: 'evt_4',
    type: 'customer.created',
    data: { object: { id: 'cus_1' } },
  });
  const t = Math.floor(Date.now() / 1000);
  assert.equal(provider.parseWebhook(raw, { 'stripe-signature': sign(raw, t) }).type, 'ignored');
});

test('an unsigned webhook throws instead of being trusted', () => {
  const provider = new StripeCheckoutProvider('sk_test_x', SECRET);
  const raw = body({ id: 'evt_5', type: 'checkout.session.completed', data: { object: { id: 'cs' } } });
  assert.throws(() => provider.parseWebhook(raw, {}), /no signature/);
});
