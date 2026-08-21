import 'dotenv/config';

/**
 * Runtime configuration.
 *
 * Every external integration degrades to a local implementation when its
 * credentials are absent, so the whole enrolment → payment → delivery path is
 * runnable and testable with no accounts set up. Switching to real Stripe test
 * mode or a real mail provider is a matter of setting the env vars, not
 * changing code.
 */

const int = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: int(process.env.PORT, 3001),

  /** Public origin, used to build return URLs and resume links. */
  appUrl: process.env.APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000',

  /** Signs resume tokens and cookies. Generated per-process if unset. */
  secret: process.env.SESSION_SECRET ?? '',

  dataDir: process.env.DATA_DIR ?? '.data',

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    priceCents: int(process.env.RESET_PRICE_CENTS, 2900),
    currency: process.env.RESET_CURRENCY ?? 'usd',
  },

  /** DICE operator console. */
  operator: {
    password: process.env.OPERATOR_PASSWORD ?? '',
  },

  mail: {
    from: process.env.MAIL_FROM ?? 'Performance Wellness <guide@example.invalid>',
    /** Resend API key. Absent → messages are written to the outbox directory. */
    resendKey: process.env.RESEND_API_KEY ?? '',
  },
} as const;

/** True when real Stripe credentials are present. */
export const stripeLive = () => config.stripe.secretKey.length > 0;

/** True when a real mail provider is configured. */
export const mailLive = () => config.mail.resendKey.length > 0;

/**
 * A missing SESSION_SECRET is survivable in development (tokens simply do not
 * outlive the process) but silently accepting one in production would mean
 * every restart logs everybody out. Callers decide how loudly to complain.
 */
export const secretIsEphemeral = () => config.secret.length === 0;
