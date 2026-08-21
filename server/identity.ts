import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Identity without accounts.
 *
 * The product promise is that nobody has to make an account. So a returning
 * person is recognised by an opaque resume token: 32 random bytes, delivered
 * in an httpOnly cookie and embedded in every email link. Only its SHA-256 is
 * stored, so a leaked database does not hand out live sessions.
 *
 * This is a bearer credential, which is the right trade for a seven-day
 * wellness plan and the wrong one for anything holding money or medical
 * records. If this ever guards more than a check-in log, it needs to become a
 * real authentication step.
 */

export interface ResumeToken {
  /** Given to the client. Never stored. */
  token: string;
  /** Stored against the enrolment. */
  hash: string;
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export function issueResumeToken(): ResumeToken {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

/**
 * Constant-time comparison of a presented token against a stored hash.
 * A plain `===` here would leak the hash a byte at a time under timing attack.
 */
export function tokenMatches(presented: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(presented), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const RESUME_COOKIE = 'pw_resume';

/** Ninety days: long enough to cover the week plus a long gap back. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export function resumeCookie(token: string, secure: boolean): string {
  return [
    `${RESUME_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearResumeCookie(): string {
  return `${RESUME_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Reads the resume token from a Cookie header, if present. */
export function readResumeCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === RESUME_COOKIE && rest.length) return rest.join('=');
  }
  return null;
}

/**
 * Email addresses are the one piece of contact data collected. Validated
 * loosely on purpose — the authoritative test is whether the first message
 * arrives, not whether it satisfies a regex.
 */
export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return null;
  return email;
}

export const newEnrollmentId = (): string => `enr_${randomBytes(9).toString('base64url')}`;
