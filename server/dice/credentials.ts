import type { AuthStatus, DeskGrants, DeskId, DeskLimits } from './types';

/**
 * Credential store.
 *
 * Reddit client credentials are read from the environment here and never leave
 * this module. Desk objects carry an AuthStatus and nothing else — no client
 * id, no secret, no token — so there is no path by which a credential reaches
 * a serialised API response or the browser bundle.
 *
 * Persona identity and Reddit credentials are related but separate objects,
 * exactly as specified. `server/dice/accounts.ts` holds the identity; this
 * holds the secret; the only thing that crosses is a status enum.
 *
 * Env shape, per desk (desk id upper-cased with dashes as underscores):
 *   DICE_REDDIT_STABILIZER_CLIENT_ID
 *   DICE_REDDIT_STABILIZER_CLIENT_SECRET
 *   DICE_REDDIT_STABILIZER_REFRESH_TOKEN
 *   DICE_REDDIT_STABILIZER_GRANTS          e.g. "read,comment"
 *   DICE_REDDIT_STABILIZER_RATE            e.g. "100/60"  (requests/seconds)
 */

interface DeskCredential {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const envKey = (deskId: DeskId, suffix: string) =>
  `DICE_REDDIT_${deskId.toUpperCase().replace(/-/g, '_')}_${suffix}`;

const read = (deskId: DeskId, suffix: string): string =>
  process.env[envKey(deskId, suffix)]?.trim() ?? '';

/** Never exported. Nothing outside this module can obtain the secret material. */
function credentialFor(deskId: DeskId): DeskCredential | null {
  const clientId = read(deskId, 'CLIENT_ID');
  const clientSecret = read(deskId, 'CLIENT_SECRET');
  const refreshToken = read(deskId, 'REFRESH_TOKEN');
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, refreshToken };
}

export function authStatusFor(deskId: DeskId): AuthStatus {
  const credential = credentialFor(deskId);
  if (!credential) return 'not-configured';
  if (!credential.refreshToken) return 'disconnected';
  return 'connected';
}

/**
 * The grants Reddit has given this client, as configured by whoever set the
 * account up. Defaults to read-only: a desk that nobody has explicitly granted
 * comment rights cannot comment.
 */
export function grantsFor(deskId: DeskId): DeskGrants {
  const raw = read(deskId, 'GRANTS');
  const granted = new Set(raw.split(',').map((g) => g.trim().toLowerCase()).filter(Boolean));
  return {
    read: granted.has('read'),
    comment: granted.has('comment'),
    message: granted.has('message'),
  };
}

/** Conservative default when nothing is configured: one request per minute. */
export const DEFAULT_LIMITS: DeskLimits = { requestsPerWindow: 60, windowSeconds: 60 };

/**
 * The rate limit explicitly configured for this desk's own client, or null when
 * nobody has set one.
 *
 * Returns null rather than a default so callers can tell "configured as 60/60"
 * apart from "nobody said". A configured limit always wins — including in
 * fixture mode, where a desk that has been told its real limit must still
 * respect it.
 */
export function configuredLimits(deskId: DeskId): DeskLimits | null {
  const raw = read(deskId, 'RATE');
  const match = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  const requestsPerWindow = Number(match[1]);
  const windowSeconds = Number(match[2]);
  if (requestsPerWindow <= 0 || windowSeconds <= 0) return null;

  return { requestsPerWindow, windowSeconds };
}

/** The limit to enforce for a real desk: configured, or the small default. */
export const limitsFor = (deskId: DeskId): DeskLimits => configuredLimits(deskId) ?? DEFAULT_LIMITS;
