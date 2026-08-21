import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Operator authentication.
 *
 * The DICE console holds ten Reddit identities and a lead pipeline. It cannot
 * be what the persona console was until now — a tab anyone who loaded the app
 * could click.
 *
 * One shared operator password, exchanged for a signed session cookie. That is
 * deliberately modest: it is an internal tool for a small team, and a real
 * identity provider is the right answer the moment more than a few people use
 * it. What it is not is optional.
 *
 * If OPERATOR_PASSWORD is unset, one is generated at boot and printed to the
 * server log. The console is never open — an unconfigured deployment gets a
 * random password, not no password.
 */

const SESSION_COOKIE = 'pw_operator';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface OperatorAuth {
  password: string;
  /** True when the password was generated rather than configured. */
  ephemeral: boolean;
  secret: string;
}

export function initOperatorAuth(configured: string, secret: string): OperatorAuth {
  const password = configured.trim();
  return password
    ? { password, ephemeral: false, secret }
    : { password: randomBytes(12).toString('base64url'), ephemeral: true, secret };
}

const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function issueSession(auth: OperatorAuth, now: Date): string {
  const expires = Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS;
  const payload = `operator.${expires}`;
  return `${payload}.${sign(payload, auth.secret)}`;
}

export function verifySession(token: string, auth: OperatorAuth, now: Date): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [subject, expiresRaw, provided] = parts;
  const payload = `${subject}.${expiresRaw}`;
  const expected = sign(payload, auth.secret);

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const expires = Number(expiresRaw);
  return Number.isFinite(expires) && expires * 1000 > now.getTime();
}

/** Constant-time password check, so a wrong guess leaks nothing by timing. */
export function passwordMatches(provided: string, auth: OperatorAuth): boolean {
  const a = Buffer.from(sign(provided, auth.secret));
  const b = Buffer.from(sign(auth.password, auth.secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const operatorCookie = (token: string, secure: boolean): string =>
  [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');

export const clearOperatorCookie = (): string =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;

export function readOperatorCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE && rest.length) return rest.join('=');
  }
  return null;
}

/** Express guard. Every DICE route sits behind this. */
export function requireOperator(auth: OperatorAuth, clock: () => Date) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = readOperatorCookie(req.headers.cookie);
    if (!token || !verifySession(token, auth, clock())) {
      res.status(401).json({ error: 'operator sign-in required' });
      return;
    }
    next();
  };
}
