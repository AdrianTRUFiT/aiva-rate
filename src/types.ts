/**
 * Cross-cutting record types.
 *
 * Every stage transition in a session emits an artifact and every artifact is
 * signed, so a completed session can be replayed afterwards to answer the only
 * question the optimisation layer actually needs: which front door, which
 * exercise, and did anything change.
 */

export interface Soulmark {
  signature: string;
  authorship: string;
  stage: string;
  artifactHash: string;
  timestamp: string;
}

export interface Artifact {
  id: string;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
  authorship?: string;
  soulmark?: Soulmark;
}
