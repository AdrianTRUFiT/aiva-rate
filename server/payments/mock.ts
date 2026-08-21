import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './types';

/**
 * A local stand-in for Stripe Checkout.
 *
 * Used only when STRIPE_SECRET_KEY is absent. It reproduces the shape of the
 * real flow — a hosted page you are redirected to, and a signed webhook that
 * actually confirms the payment — so the enrolment path exercises the same
 * code as production rather than a shortcut around it. Payment is confirmed by
 * the webhook here too; the browser returning from the success URL never marks
 * anything paid, exactly as with Stripe.
 */
export class MockCheckoutProvider implements PaymentProvider {
  readonly name = 'mock' as const;

  constructor(
    private readonly secret: string,
    /** Where the stand-in "hosted checkout page" lives. */
    private readonly baseUrl: string,
  ) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const id = `cs_mock_${randomBytes(8).toString('hex')}`;
    const url =
      `${this.baseUrl}/api/dev/checkout` +
      `?session=${encodeURIComponent(id)}` +
      `&enrollment=${encodeURIComponent(req.enrollmentId)}` +
      `&amount=${req.amountCents}` +
      `&currency=${encodeURIComponent(req.currency)}` +
      `&success=${encodeURIComponent(req.successUrl)}` +
      `&cancel=${encodeURIComponent(req.cancelUrl)}`;
    return { id, url, provider: 'mock' };
  }

  /** Signs a stand-in webhook body the same way the real endpoint is checked. */
  sign(rawBody: Buffer): string {
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentEvent {
    const header = headers['x-mock-signature'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided) throw new Error('mock webhook: no signature header');

    const expected = Buffer.from(this.sign(rawBody), 'hex');
    const got = Buffer.from(provided, 'hex');
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
      throw new Error('mock webhook: signature mismatch');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      type: string;
      checkoutId: string;
      enrollmentId: string;
    };

    return {
      type: event.type === 'payment.completed' ? 'payment.completed' : 'ignored',
      checkoutId: event.checkoutId,
      enrollmentId: event.enrollmentId,
      eventId: event.id,
    };
  }
}
