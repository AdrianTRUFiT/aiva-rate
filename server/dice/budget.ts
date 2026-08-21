import type { DeskId, DeskLimits } from './types';

/**
 * Per-desk rate accounting.
 *
 * Each desk spends against the limit assigned to its own authenticated client.
 * There is deliberately no pooling, no borrowing, and no fallback: when a desk
 * is spent, discovery for that desk defers until its own window resets. It does
 * not continue on another desk's budget.
 *
 * That is a hard design rule rather than an implementation detail — spreading
 * requests across accounts to get more throughput than any one of them was
 * granted is exactly the behaviour this system must not have. `spend` takes a
 * single desk id and has no way to express "try another one".
 */

export interface BudgetWindow {
  deskId: DeskId;
  windowStartedAt: string;
  used: number;
}

export interface Grant {
  /** How many requests the caller may actually make. May be less than asked. */
  granted: number;
  remaining: number;
  resetsAt: string;
  /** True when the desk has nothing left this window. */
  exhausted: boolean;
}

const windowEnd = (startedAt: string, limits: DeskLimits): Date =>
  new Date(new Date(startedAt).getTime() + limits.windowSeconds * 1000);

/** Rolls the window forward if the current one has expired. */
export function currentWindow(window: BudgetWindow, limits: DeskLimits, now: Date): BudgetWindow {
  if (now >= windowEnd(window.windowStartedAt, limits)) {
    return { deskId: window.deskId, windowStartedAt: now.toISOString(), used: 0 };
  }
  return window;
}

export const newWindow = (deskId: DeskId, now: Date): BudgetWindow => ({
  deskId,
  windowStartedAt: now.toISOString(),
  used: 0,
});

/**
 * Reserves up to `requested` units of this desk's budget.
 *
 * Returns a partial grant rather than throwing when the desk is close to its
 * limit: discovering 12 of the 40 posts you wanted is a normal outcome, and the
 * console shows the shortfall rather than pretending the run was complete.
 */
export function spend(
  window: BudgetWindow,
  limits: DeskLimits,
  requested: number,
  now: Date,
): { window: BudgetWindow; grant: Grant } {
  const rolled = currentWindow(window, limits, now);
  const remaining = Math.max(0, limits.requestsPerWindow - rolled.used);
  const granted = Math.max(0, Math.min(requested, remaining));

  const next: BudgetWindow = { ...rolled, used: rolled.used + granted };
  const left = limits.requestsPerWindow - next.used;

  return {
    window: next,
    grant: {
      granted,
      remaining: left,
      resetsAt: windowEnd(next.windowStartedAt, limits).toISOString(),
      exhausted: left <= 0,
    },
  };
}

/** Read-only view for the console, with no side effect on the window. */
export function inspect(window: BudgetWindow, limits: DeskLimits, now: Date): Grant {
  const rolled = currentWindow(window, limits, now);
  const left = limits.requestsPerWindow - rolled.used;
  return {
    granted: 0,
    remaining: Math.max(0, left),
    resetsAt: windowEnd(rolled.windowStartedAt, limits).toISOString(),
    exhausted: left <= 0,
  };
}
