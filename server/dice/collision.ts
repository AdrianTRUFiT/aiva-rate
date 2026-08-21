import type { Collision, DeskId, Signal, SignalState } from './types';

/**
 * The one thing the ten desks share.
 *
 * Everything else about a desk is independent — its credentials, its budget,
 * its lens, its queue. This index exists so that two desks cannot unknowingly
 * work the same person or the same thread, which is the single behaviour that
 * would turn ten legitimate desks into something that looks coordinated from
 * the outside.
 *
 * It is a check, not a lock: it surfaces the conflict to the operator and
 * denies the channel action. A human decides what happens next.
 */

/** States that count as this desk having actually engaged. */
const ENGAGED: SignalState[] = ['activated', 'replied', 'follow-up', 'qualified', 'closed'];

export interface CollisionIndex {
  /** author (lowercased) → who touched them, when, in what state. */
  byAuthor: Map<string, { deskId: DeskId; at: string; state: SignalState }>;
  /** subreddit:postId → same. */
  byThread: Map<string, { deskId: DeskId; at: string; state: SignalState }>;
}

export const emptyIndex = (): CollisionIndex => ({
  byAuthor: new Map(),
  byThread: new Map(),
});

const threadKey = (subreddit: string, postId: string) => `${subreddit.toLowerCase()}:${postId}`;

/**
 * Builds the index from every signal across every desk.
 *
 * Only engaged states are indexed. A signal sitting unreviewed in one desk's
 * queue is not a collision — two desks may legitimately discover the same post,
 * and blocking on that would make the queues useless.
 */
export function buildIndex(signals: Signal[]): CollisionIndex {
  const index = emptyIndex();

  for (const signal of signals) {
    if (!ENGAGED.includes(signal.state)) continue;

    const at = signal.history[signal.history.length - 1]?.at ?? signal.discoveredAt;
    const entry = { deskId: signal.deskId, at, state: signal.state };

    index.byAuthor.set(signal.author.toLowerCase(), entry);
    index.byThread.set(threadKey(signal.subreddit, signal.postId), entry);
  }

  return index;
}

/**
 * Checks whether another desk has already engaged this person or thread.
 *
 * A desk colliding with itself is not a collision — that is just its own
 * ongoing conversation.
 */
export function checkCollision(
  index: CollisionIndex,
  deskId: DeskId,
  author: string,
  subreddit: string,
  postId: string,
): Collision | null {
  const thread = index.byThread.get(threadKey(subreddit, postId));
  if (thread && thread.deskId !== deskId) {
    return { deskId: thread.deskId, at: thread.at, state: thread.state, on: 'thread' };
  }

  const person = index.byAuthor.get(author.toLowerCase());
  if (person && person.deskId !== deskId) {
    return { deskId: person.deskId, at: person.at, state: person.state, on: 'author' };
  }

  return null;
}

/**
 * Re-checks every signal in a desk's queue against the current index.
 *
 * Run after any state change anywhere, because a collision can appear after a
 * signal was queued: another desk activating a thread this morning makes this
 * desk's copy of it un-actionable this afternoon.
 */
export function annotate(signals: Signal[], index: CollisionIndex): Signal[] {
  return signals.map((signal) => ({
    ...signal,
    collision: checkCollision(index, signal.deskId, signal.author, signal.subreddit, signal.postId),
  }));
}
