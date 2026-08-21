/**
 * Payment provider seam.
 *
 * Two implementations: real Stripe Checkout, and a local one used when no
 * Stripe key is present. The local provider exists so the whole enrolment →
 * payment → delivery path is runnable and testable end to end without an
 * account, not to fake payments in production — `stripeLive()` decides, and
 * the mode is reported on every checkout so it cannot be mistaken.
 */

export interface CheckoutRequest {
  enrollmentId: string;
  email: string;
  amountCents: number;
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  provider: 'stripe' | 'mock';
}

/** A payment event, normalised across providers. */
export interface PaymentEvent {
  type: 'payment.completed' | 'payment.failed' | 'ignored';
  checkoutId: string | null;
  enrollmentId: string | null;
  /** Provider event id, used to drop replays. */
  eventId: string | null;
}

export interface PaymentProvider {
  readonly name: 'stripe' | 'mock';
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Verifies and parses an incoming webhook. Throws on an invalid signature —
   * callers must let that reject the request rather than falling back to
   * trusting the body.
   */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentEvent;
}
