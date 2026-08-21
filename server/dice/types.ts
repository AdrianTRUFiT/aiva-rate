import type { PersonaId, PressureId } from '../../src/pw/types';

/**
 * DICE — a ten-desk prospecting console sitting on top of Reddit.
 *
 * Each desk is one company-operated Reddit identity with its own authenticated
 * status, its own listening lens, its own rate budget, and its own queue. Desks
 * do not pool anything: not credentials, not rate limit, not queues. The single
 * thing shared between them is the collision index, whose only job is to stop
 * two desks unknowingly working the same person.
 */

/** A desk is identified by the persona that operates it. */
export type DeskId = PersonaId;

export type AuthStatus =
  | 'connected'
  | 'expired'
  | 'disconnected'
  | 'not-configured';

/**
 * What Reddit has actually granted this authenticated client — not what we
 * would like it to be able to do. Read separately from comment and message
 * because they are separately granted and separately revocable.
 */
export interface DeskGrants {
  read: boolean;
  comment: boolean;
  message: boolean;
}

/**
 * The rate limit assigned to this desk's own authenticated client.
 *
 * Deliberately per-desk with no pooling and no fallback: when a desk is spent,
 * discovery for that desk defers until its window resets. It never continues
 * on another desk's budget. See budget.ts.
 */
export interface DeskLimits {
  requestsPerWindow: number;
  windowSeconds: number;
}

/** The desk's listening lens — how this persona hears the market. */
export interface DeskLens {
  subreddits: string[];
  keywords: string[];
  exclusions: string[];
  /** The pressure moment this desk is designed to address. */
  pressure: PressureId;
}

/**
 * A desk as it is safe to send to the browser.
 *
 * Contains no client id, no secret, no refresh token. Credentials live in
 * server/dice/credentials.ts and are never attached to this object — the desk
 * knows only whether its credentials resolved.
 */
export interface Desk {
  id: DeskId;
  persona: PersonaId;
  /** Public Reddit handle, e.g. u/steady_reset. Shown to operators. */
  handle: string;
  auth: AuthStatus;
  /**
   * True when this desk's auth and grants are simulated by the fixture source
   * rather than resolved from real credentials. Surfaced in the console so a
   * simulated desk can never be mistaken for a live one.
   */
  simulated: boolean;
  grants: DeskGrants;
  limits: DeskLimits;
  lens: DeskLens;
}

/* ------------------------------------------------------------------------- */
/* Signals                                                                    */
/* ------------------------------------------------------------------------- */

/** What a source returns before DICE has processed it. */
export interface RawSignal {
  sourceId: string;
  subreddit: string;
  postId: string;
  author: string;
  title: string;
  body: string;
  permalink: string;
  createdAt: string;
}

export type SignalState =
  | 'new'
  | 'priority'
  | 'watching'
  | 'rejected'
  | 'activated'
  | 'replied'
  | 'follow-up'
  | 'qualified'
  | 'closed'
  /** Screened out: crisis language. Never contactable, never queued. */
  | 'do-not-contact'
  /** Screened out: the subreddit is off-limits for outreach. */
  | 'blocked';

export const OPERATOR_STATES: SignalState[] = [
  'new',
  'priority',
  'watching',
  'activated',
  'replied',
  'follow-up',
  'qualified',
  'closed',
  'rejected',
];

/** Whether a channel action is available, and why or why not. */
export interface ActionGate {
  allowed: boolean;
  reason: string;
}

/**
 * Channel actions are resolved explicitly and default to denied.
 *
 * Discovery, scoring, queueing and recommending are always available. Replying
 * and messaging are available only where this desk's grants AND the
 * subreddit's rules AND the safety screen AND the collision check all permit
 * it. Any one of them says no and the action stays off.
 */
export interface ActionPermissions {
  reply: ActionGate;
  message: ActionGate;
}

export interface SignalScores {
  /** How well this matches the desk's lens, 0–100. */
  fit: number;
  /** How much the poster appears to be asking for help, 0–100. */
  intent: number;
  /** Hours since the post was made. */
  freshnessHours: number;
  /** Combined ranking score used to order the queue. */
  priority: number;
}

/** A collision: another desk already touched this person or thread. */
export interface Collision {
  deskId: DeskId;
  at: string;
  state: SignalState;
  /** 'author' when the same person, 'thread' when the same post. */
  on: 'author' | 'thread';
}

export interface Signal {
  id: string;
  deskId: DeskId;
  source: string;

  subreddit: string;
  postId: string;
  author: string;
  title: string;
  excerpt: string;
  permalink: string;
  createdAt: string;
  discoveredAt: string;

  scores: SignalScores;
  /** Plain-language explanation of why DICE surfaced this. */
  reasons: string[];

  state: SignalState;
  /** Why a screened-out signal was screened out. */
  screenedReason: string | null;

  actions: ActionPermissions;
  collision: Collision | null;

  /** Operator's own notes and the trail of what was done. */
  history: { at: string; event: string; detail?: string }[];
}

/**
 * The reduction from a raw result pool to a day's work. This is the number the
 * console leads with, because it is the actual productivity claim.
 */
export interface FunnelCounts {
  discovered: number;
  afterDedup: number;
  /** Removed by the subreddit blocklist or the crisis screen. */
  screenedOut: number;
  relevant: number;
  strong: number;
  priorityToday: number;
}

export interface DeskSummary {
  desk: Desk;
  counts: FunnelCounts;
  queue: Record<SignalState, number>;
  budget: {
    used: number;
    limit: number;
    resetsAt: string;
    exhausted: boolean;
  };
  lastDiscoveryAt: string | null;
}
