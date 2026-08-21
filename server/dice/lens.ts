import { isBlocked, normaliseSubreddit } from './policy';
import type { DeskLens } from './types';

/**
 * Operator-editable lens configuration.
 *
 * A desk's listening lens is now data, not code: an operator can change which
 * subreddits a desk watches, which cues it listens for, what it excludes, and
 * how strict it is — without an edit to accounts.ts.
 *
 * What they cannot change is the policy floor. A blocked subreddit is refused
 * at save time with the reason, rather than silently stripped: quietly altering
 * somebody's stated intent is worse than telling them no.
 */

/** The parts of a lens an operator may set. */
export interface LensOverride {
  subreddits: string[];
  keywords: string[];
  exclusions: string[];
  /** Priority floor for the queue, 0–100. */
  minScore: number;
  /** Posts older than this are dropped rather than ranked. */
  maxAgeHours: number;
}

export const DEFAULT_MIN_SCORE = 45;
export const DEFAULT_MAX_AGE_HOURS = 168;

export type EditableLens = DeskLens & Pick<LensOverride, 'minScore' | 'maxAgeHours'>;

export interface LensValidation {
  ok: boolean;
  /** Subreddits refused by the policy floor, with the reason for each. */
  refused: { name: string; reason: string }[];
  /** The cleaned value, safe to store. Only meaningful when ok. */
  value: LensOverride;
}

const clean = (values: unknown, limit: number): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim().toLowerCase();
    if (!value || value.length > 60 || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
};

const clamp = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

/**
 * Validates an operator's proposed lens.
 *
 * Blocked subreddits make the whole save fail rather than being dropped, so the
 * operator finds out that r/depression is off-limits instead of wondering why
 * their configured desk never returns anything from it.
 */
export function validateLens(input: Partial<LensOverride>): LensValidation {
  const subreddits = clean(input.subreddits, 40).map(normaliseSubreddit);
  const refused: { name: string; reason: string }[] = [];

  for (const name of subreddits) {
    const rule = isBlocked(name);
    if (rule) refused.push({ name, reason: rule.reason ?? 'Off-limits for outreach.' });
  }

  return {
    ok: refused.length === 0,
    refused,
    value: {
      subreddits,
      keywords: clean(input.keywords, 60),
      exclusions: clean(input.exclusions, 60),
      minScore: clamp(input.minScore, DEFAULT_MIN_SCORE, 0, 100),
      maxAgeHours: clamp(input.maxAgeHours, DEFAULT_MAX_AGE_HOURS, 1, 8760),
    },
  };
}

/** Merges a stored override over the desk's shipped defaults. */
export function mergeLens(base: DeskLens, override: LensOverride | null): EditableLens {
  if (!override) {
    return { ...base, minScore: DEFAULT_MIN_SCORE, maxAgeHours: DEFAULT_MAX_AGE_HOURS };
  }
  return {
    pressure: base.pressure,
    subreddits: override.subreddits.length ? override.subreddits : base.subreddits,
    keywords: override.keywords.length ? override.keywords : base.keywords,
    exclusions: override.exclusions,
    minScore: override.minScore,
    maxAgeHours: override.maxAgeHours,
  };
}
