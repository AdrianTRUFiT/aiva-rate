import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './types';

const API = 'https://api.stripe.com/v1';

/** Stripe tolerates a 5-minute clock difference on webhook timestamps. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Verifies a Stripe webhook signature.
 *
 * The signed payload is `${timestamp}.${rawBody}`, HMAC-SHA256 with the
 * endpoint secret. The raw bytes matter: re-serialising the parsed JSON
 * produces a different string and every signature check fails, which is why
 * the webhook route mounts express.raw rather than express.json.
 *
 * Exported so it can be tested against known vectors without a network call.
 */
export function verifyStripeSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): void {
  const parts = new Map(
    signatureHeader.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k, v.join('=')] as const;
    }),
  );

  const timestamp = Number(parts.get('t'));
  if (!Number.isFinite(timestamp)) throw new Error('stripe signature: missing timestamp');

  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error('stripe signature: timestamp outside tolerance');
  }

  const provided = parts.get('v1');
  if (!provided) throw new Error('stripe signature: no v1 signature');

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('stripe signature: mismatch');
  }
}

/** Stripe takes form-encoded bodies with bracketed nesting. */
const form = (obj: Record<string, string | number>): string =>
  Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

export class StripeCheckoutProvider implements PaymentProvider {
  readonly name = 'stripe' as const;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const res = await fetch(`${API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Retrying a checkout for the same enrolment must not create a second
        // charge, so the enrolment id is the idempotency key.
        'Idempotency-Key': `checkout_${req.enrollmentId}`,
      },
      body: form({
        mode: 'payment',
        'line_items[0][price_data][currency]': req.currency,
        'line_items[0][price_data][product_data][name]': req.productName,
        'line_items[0][price_data][unit_amount]': req.amountCents,
        'line_items[0][quantity]': 1,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        client_reference_id: req.enrollmentId,
        customer_email: req.email,
        'metadata[enrollment_id]': req.enrollmentId,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`stripe checkout failed (${res.status}): ${detail.slice(0, 500)}`);
    }

    const session = (await res.json()) as { id: string; url: string };
    return { id: session.id, url: session.url, provider: 'stripe' };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentEvent {
    const header = headers['stripe-signature'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) throw new Error('stripe webhook: no signature header');

    verifyStripeSignature(rawBody, signature, this.webhookSecret);

    const event = JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      type: string;
      data: { object: { id: string; client_reference_id?: string; metadata?: Record<string, string> } };
    };

    const object = event.data.object;
    const enrollmentId = object.client_reference_id ?? object.metadata?.enrollment_id ?? null;

    // Only these two move money. Everything else Stripe sends is acknowledged
    // and ignored, so an over-broad endpoint subscription is harmless.
    if (event.type === 'checkout.session.completed') {
      return { type: 'payment.completed', checkoutId: object.id, enrollmentId, eventId: event.id };
    }
    if (event.type === 'checkout.session.async_payment_failed') {
      return { type: 'payment.failed', checkoutId: object.id, enrollmentId, eventId: event.id };
    }
    return { type: 'ignored', checkoutId: object.id ?? null, enrollmentId, eventId: event.id };
  }
}
