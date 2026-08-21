import { FixtureSignalSource } from './fixture';
import type { SignalSource } from './types';

/**
 * Source selection.
 *
 * Only the fixture exists today. The real Reddit adapter stays behind this seam
 * until the authorised access model is resolved — which means credentials, the
 * rate limit actually assigned to each client, and a read of each target
 * subreddit's current rules. Adding it is a new class implementing
 * SignalSource plus a branch here; nothing upstream changes.
 */
let source: SignalSource | null = null;

export function signalSource(): SignalSource {
  if (!source) source = new FixtureSignalSource();
  return source;
}

/** Test seam. */
export function setSignalSource(next: SignalSource | null): void {
  source = next;
}

export type { SignalSource, DiscoveryRequest, DiscoveryResult, ActionResult } from './types';
