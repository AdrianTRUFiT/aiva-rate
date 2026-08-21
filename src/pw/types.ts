/**
 * Performance Wellness Operating System — domain types.
 *
 * The system is organised around *pressure moments*, not demographics. A person
 * arrives carrying something. The engine's job is to hear it, name it, hand back
 * one small usable action, and only then — if something actually shifted — offer
 * to keep going.
 */

/** The eight doctrine stages. Order is load-bearing: the offer gate depends on it. */
export type FunnelStage =
  | 'THRESHOLD'      // SoulHost: "What is putting the most pressure on you right now?"
  | 'REFLECTION'     // Empathy + understanding, in persona voice
  | 'EDUCATION'      // One small explanation of what is happening internally
  | 'ACTION'         // The micro-intervention itself
  | 'CHECKPOINT'     // Did anything shift? (an honest question, "no" is a real answer)
  | 'TRANSFORMATION' // A reported change, recorded
  | 'OFFER'          // The 7-Day Reset invitation — reachable only when earned
  | 'CONTINUATION';  // Daily check-ins

/** Terminal state entered when a safety signal is detected. Halts the funnel. */
export type SessionOutcome =
  | 'IN_PROGRESS'
  | 'COMPLETED_WITH_OFFER'
  | 'COMPLETED_NO_OFFER'
  | 'ROUTED_TO_SUPPORT'
  | 'DECLINED';

export type PersonaId =
  | 'stabilizer'
  | 'clarifier'
  | 'companion'
  | 'rebuilder'
  | 'navigator'
  | 'regulator'
  | 'architect'
  | 'unraveler'
  | 'encourager'
  | 'continuity-guide';

export type PressureId =
  | 'sudden-shock'
  | 'overwhelm'
  | 'isolation'
  | 'identity-disruption'
  | 'decision-paralysis'
  | 'burnout'
  | 'new-beginning'
  | 'racing-thoughts'
  | 'self-doubt'
  | 'continuation';

export type Channel =
  | 'youtube'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'shorts'
  | 'reels'
  | 'reddit'
  | 'x'
  | 'newsletter'
  | 'in-product';

export type ContentFormat =
  | 'long-form'
  | 'short-form'
  | 'carousel'
  | 'thread'
  | 'article'
  | 'check-in';

/** A pressure moment: the front door a person walks through. */
export interface PressureMoment {
  id: PressureId;
  label: string;
  /** How a person describes it in their own words, used for classification. */
  cues: string[];
  /** Plain-language description of what is happening internally. */
  mechanism: string;
  /** The persona that owns this front door. */
  owner: PersonaId;
  /** Secondary personas that reinforce, in order of usefulness. */
  support: PersonaId[];
}

export interface VisualIdentity {
  symbol: string;
  palette: [string, string];
  style: string;
  signal: string;
}

/** A front-end guide. Ten of them, one brand, all disclosed as AI. */
export interface Persona {
  id: PersonaId;
  name: string;
  pressure: PressureId;
  /** Voice descriptors that drive prompt assembly. */
  voice: string[];
  /** Characteristic phrasings — the tone floor, not a script. */
  tone: string[];
  /** What this persona is actually for. */
  fn: string;
  /** The change a person should be able to notice, in their own words. */
  microTransformation: string;
  /** The persona's primary intervention. */
  signatureMove: string;
  visual: VisualIdentity;
  channels: Channel[];
  /** Operational mailbox that routes this persona's mail. Never shown to a user. */
  mailbox: string;
}

export interface InterventionStep {
  instruction: string;
  /** Seconds to hold on this step in the guided runner. */
  seconds: number;
  /** Optional detail shown under the instruction. */
  detail?: string;
}

/** A micro-intervention: 90 seconds to 3 minutes, one usable action. */
export interface Intervention {
  id: string;
  name: string;
  persona: PersonaId;
  pressure: PressureId;
  /** One sentence on what this does and why it works. */
  premise: string;
  steps: InterventionStep[];
  /** The question asked at CHECKPOINT, phrased so "no" is easy to say. */
  checkpointQuestion: string;
  /** Total runtime in seconds, derived from steps. */
  durationSeconds: number;
}

/** What a person reported at the checkpoint. */
export type ShiftReport = 'shifted' | 'unchanged' | 'worse';

export interface JourneyEvent {
  id: string;
  at: string;
  stage: FunnelStage;
  kind: string;
  detail: Record<string, unknown>;
}

export interface SessionState {
  id: string;
  startedAt: string;
  stage: FunnelStage;
  outcome: SessionOutcome;
  /** The person's own words. Never leaves the browser in this build. */
  statement: string;
  pressure: PressureId | null;
  persona: PersonaId | null;
  intervention: Intervention | null;
  interventionCompleted: boolean;
  shift: ShiftReport | null;
  /** How many interventions have been attempted this session. */
  attempts: number;
  events: JourneyEvent[];
  /** Set when a safety signal routes the session out of the funnel. */
  safetyRouted: boolean;
}

/** Result of the offer gate. The doctrine is: earn the transaction. */
export interface OfferDecision {
  allowed: boolean;
  reason: string;
  /** What to do instead when the offer is not allowed. */
  alternative: 'another-intervention' | 'no-pressure-close' | 'support-resources' | null;
}
