import type { AuthStatus, Desk, RawSignal } from '../types';

/**
 * The provider seam.
 *
 * DICE never talks to Reddit directly. It asks a SignalSource for raw signals
 * within a budget the caller has already reserved, and the source returns at
 * most that many. The real Reddit adapter sits behind this interface and is not
 * implemented until the authorised access model is resolved; the fixture
 * provider implements the same contract so the whole operator workflow runs
 * without hard-coding any assumption about Reddit access.
 *
 * Note what the interface does NOT allow: there is no way to ask for signals
 * without naming one desk, and no way to ask for more than the granted budget.
 * Discovery is per-desk by construction.
 */

export interface DiscoveryRequest {
  desk: Desk;
  /** Subreddits already filtered through the policy blocklist. */
  subreddits: string[];
  /** The hard ceiling on requests this run, from the desk's own budget. */
  budget: number;
  now: Date;
}

export interface DiscoveryResult {
  signals: RawSignal[];
  /** How much of the budget the source actually consumed. */
  spent: number;
  /** True when the source stopped early because the budget ran out. */
  truncated: boolean;
}

export type ActionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export interface SignalSource {
  readonly name: string;
  /** Whether this desk's account is usable right now. */
  status(desk: Desk): Promise<AuthStatus>;
  discover(request: DiscoveryRequest): Promise<DiscoveryResult>;
  /**
   * Optional. A source that cannot post does not implement this, and DICE
   * treats its absence as "discovery only" rather than as an error.
   */
  reply?(desk: Desk, signal: { postId: string; subreddit: string }, text: string): Promise<ActionResult>;
}
