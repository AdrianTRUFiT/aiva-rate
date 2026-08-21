import type {
  FunnelStage,
  OfferDecision,
  SessionState,
  ShiftReport,
} from './types';

/**
 * The funnel, as a state machine with one hard gate.
 *
 * Empathy → Understanding → Education → Action → Small result → Transformation
 * → Transaction → Continuation.
 *
 * The doctrine that makes this different from a landing page is that the
 * TRANSACTION stage is unreachable unless a transformation was actually
 * reported. That is enforced here, in one function, rather than being left to
 * the discretion of whatever is rendering the page.
 */

export const STAGE_ORDER: FunnelStage[] = [
  'THRESHOLD',
  'REFLECTION',
  'EDUCATION',
  'ACTION',
  'CHECKPOINT',
  'TRANSFORMATION',
  'OFFER',
  'CONTINUATION',
];

export const STAGE_LABELS: Record<FunnelStage, string> = {
  THRESHOLD: 'Hear me',
  REFLECTION: 'Understand it',
  EDUCATION: 'Explain it',
  ACTION: 'Do one thing',
  CHECKPOINT: 'Notice the change',
  TRANSFORMATION: 'Name the result',
  OFFER: 'Keep going',
  CONTINUATION: 'Stay with it',
};

/** After this many attempts we stop offering exercises and close gently. */
export const MAX_ATTEMPTS = 3;

const ALLOWED: Record<FunnelStage, FunnelStage[]> = {
  THRESHOLD: ['REFLECTION'],
  REFLECTION: ['EDUCATION'],
  EDUCATION: ['ACTION'],
  ACTION: ['CHECKPOINT'],
  // A checkpoint can loop back to another exercise, or move forward.
  CHECKPOINT: ['ACTION', 'TRANSFORMATION'],
  TRANSFORMATION: ['OFFER'],
  OFFER: ['CONTINUATION'],
  CONTINUATION: [],
};

export const canTransition = (from: FunnelStage, to: FunnelStage): boolean =>
  ALLOWED[from].includes(to);

/**
 * The offer gate.
 *
 * Returns whether the 7-Day Reset may be offered, and — when it may not — what
 * should happen instead. Nothing in the UI is permitted to render a commercial
 * offer without going through this.
 */
export function evaluateOffer(session: SessionState): OfferDecision {
  if (session.safetyRouted) {
    return {
      allowed: false,
      reason: 'Session was routed to support. Nothing is sold to someone in crisis.',
      alternative: 'support-resources',
    };
  }

  if (!session.interventionCompleted) {
    return {
      allowed: false,
      reason: 'No intervention has been completed. There is nothing to have earned an offer.',
      alternative: 'another-intervention',
    };
  }

  if (session.shift === null) {
    return {
      allowed: false,
      reason: 'The person has not reported whether anything changed.',
      alternative: 'another-intervention',
    };
  }

  if (session.shift === 'worse') {
    return {
      allowed: false,
      reason: 'The person reported feeling worse. Selling into that is indefensible.',
      alternative: 'support-resources',
    };
  }

  if (session.shift === 'unchanged') {
    return session.attempts < MAX_ATTEMPTS
      ? {
          allowed: false,
          reason: 'Nothing shifted yet. Offer a different exercise, not a purchase.',
          alternative: 'another-intervention',
        }
      : {
          allowed: false,
          reason: `Nothing shifted after ${MAX_ATTEMPTS} attempts. Close without pressure.`,
          alternative: 'no-pressure-close',
        };
  }

  return {
    allowed: true,
    reason: 'A micro-transformation was reported after a completed intervention.',
    alternative: null,
  };
}

/** Where a checkpoint answer sends the session. */
export function stageAfterCheckpoint(shift: ShiftReport, attempts: number): FunnelStage {
  if (shift === 'shifted') return 'TRANSFORMATION';
  if (shift === 'worse') return 'TRANSFORMATION'; // recorded, then closed without an offer
  return attempts < MAX_ATTEMPTS ? 'ACTION' : 'TRANSFORMATION';
}

export const stageIndex = (stage: FunnelStage): number => STAGE_ORDER.indexOf(stage);
