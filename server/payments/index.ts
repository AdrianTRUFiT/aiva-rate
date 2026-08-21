import { config, stripeLive } from '../config';
import { MockCheckoutProvider } from './mock';
import { StripeCheckoutProvider } from './stripe';
import type { PaymentProvider } from './types';

let provider: PaymentProvider | null = null;

/**
 * Selects the payment provider once per process. Real Stripe whenever a secret
 * key is present; the local stand-in otherwise.
 */
export function paymentProvider(secret: string): PaymentProvider {
  if (provider) return provider;
  provider = stripeLive()
    ? new StripeCheckoutProvider(config.stripe.secretKey, config.stripe.webhookSecret)
    : new MockCheckoutProvider(secret, config.appUrl);
  return provider;
}

export type { PaymentProvider } from './types';
