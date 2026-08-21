import { resolveActions, screenSignal, searchableSubreddits } from './policy';
import { PRIORITY_THRESHOLD, RELEVANT_THRESHOLD, STRONG_THRESHOLD, dedupeKey, scoreSignal } from './scoring';
import { checkCollision, type CollisionIndex } from './collision';
import type { Desk, FunnelCounts, RawSignal, Signal } from './types';

/**
 * 500 discovered → 146 relevant → 37 strong → 12 worth attention today.
 *
 * The reduction is the product. An operator opening a desk should be looking at
 * a dozen things a person could actually do today, not a search result page,
 * and should be able to see exactly how many were dropped and why.
 *
 * Order matters and is not negotiable: dedupe, then screen, then score. Policy
 * runs before scoring so a crisis post or a blocked subreddit is never ranked
 * at all — a "high priority" crisis post should not be able to exist even
 * transiently in this system.
 */

export interface PipelineResult {
  signals: Signal[];
  counts: FunnelCounts;
}

export interface PipelineInput {
  desk: Desk;
  raw: RawSignal[];
  index: CollisionIndex;
  /** Dedupe keys already present in the desk's stored queue. */
  known: Set<string>;
  now: Date;
}

export function runPipeline({ desk, raw, index, known, now }: PipelineInput): PipelineResult {
  const counts: FunnelCounts = {
    discovered: raw.length,
    afterDedup: 0,
    screenedOut: 0,
    relevant: 0,
    strong: 0,
    priorityToday: 0,
  };

  /* 1. Dedupe — within this run and against what the desk already holds. */
  const seen = new Set<string>(known);
  const unique: RawSignal[] = [];
  for (const item of raw) {
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  counts.afterDedup = unique.length;

  /* 2. Screen — policy before scoring, always. */
  const signals: Signal[] = [];

  for (const item of unique) {
    const screened = screenSignal(item);
    const collision = checkCollision(index, desk.id, item.author, item.subreddit, item.postId);

    if (!screened.ok) {
      counts.screenedOut++;
      // Screened-out signals are kept as a counted, inspectable record with no
      // scores and no actions. They are never queued and never ranked.
      signals.push(makeSignal(desk, item, now, {
        state: screened.state,
        screenedReason: screened.reason,
        scores: { fit: 0, intent: 0, freshnessHours: 0, priority: 0 },
        reasons: [screened.reason],
        actions: resolveActions(desk, item.subreddit, screened, collision),
        collision,
      }));
      continue;
    }

    /* 3. Score. */
    const { scores, reasons, commercial } = scoreSignal(desk, item, now);

    // Promotional and bot-shaped posts are rejected outright rather than
    // ranked low, so they never occupy space in a queue.
    if (commercial || scores.priority < RELEVANT_THRESHOLD) {
      signals.push(makeSignal(desk, item, now, {
        state: 'rejected',
        screenedReason: commercial ? 'Promotional or bot-shaped post.' : 'Below the relevance bar.',
        scores,
        reasons,
        actions: resolveActions(desk, item.subreddit, screened, collision),
        collision,
      }));
      continue;
    }

    counts.relevant++;
    if (scores.priority >= STRONG_THRESHOLD) counts.strong++;

    const isPriority = scores.priority >= PRIORITY_THRESHOLD && !collision;
    if (isPriority) counts.priorityToday++;

    signals.push(makeSignal(desk, item, now, {
      state: isPriority ? 'priority' : 'new',
      screenedReason: null,
      scores,
      reasons,
      actions: resolveActions(desk, item.subreddit, screened, collision),
      collision,
    }));
  }

  // Highest priority first — the queue order an operator works top-down.
  signals.sort((a, b) => b.scores.priority - a.scores.priority);

  return { signals, counts };
}

function makeSignal(
  desk: Desk,
  raw: RawSignal,
  now: Date,
  rest: Pick<Signal, 'state' | 'screenedReason' | 'scores' | 'reasons' | 'actions' | 'collision'>,
): Signal {
  return {
    id: `${desk.id}:${dedupeKey(raw)}`,
    deskId: desk.id,
    source: raw.sourceId.split(':')[0],
    subreddit: raw.subreddit,
    postId: raw.postId,
    author: raw.author,
    title: raw.title,
    // Excerpt only. DICE does not warehouse full post bodies.
    excerpt: raw.body.length > 600 ? `${raw.body.slice(0, 600)}…` : raw.body,
    permalink: raw.permalink,
    createdAt: raw.createdAt,
    discoveredAt: now.toISOString(),
    history: [{ at: now.toISOString(), event: 'discovered' }],
    ...rest,
  };
}

/**
 * The subreddits a desk may actually search, and which of its configured ones
 * were refused. Exposed so the console can show an operator that their
 * configuration includes something the policy will not query.
 */
export const resolveSearchScope = searchableSubreddits;
