import { create } from 'zustand';
import { SoulmarksService } from '../services/SoulmarksService';
import type { Artifact } from '../types';
import { classify, getPressure, LOW_CONFIDENCE } from '../pw/pressure';
import { interventionForPersona, nextIntervention } from '../pw/interventions';
import { evaluateOffer, MAX_ATTEMPTS, stageAfterCheckpoint } from '../pw/funnel';
import { screen, type SafetySignal } from '../pw/safety';
import type {
  FunnelStage,
  JourneyEvent,
  OfferDecision,
  PressureId,
  SessionState,
  ShiftReport,
} from '../pw/types';

const ledger = SoulmarksService.getInstance('performance-wellness-engine');

const newSession = (): SessionState => ({
  id: `pw_${Date.now().toString(36)}`,
  startedAt: new Date().toISOString(),
  stage: 'THRESHOLD',
  outcome: 'IN_PROGRESS',
  statement: '',
  pressure: null,
  persona: null,
  intervention: null,
  interventionCompleted: false,
  shift: null,
  attempts: 0,
  events: [],
  safetyRouted: false,
});

/** Signs and appends a journey event. Every stage change goes through this. */
const record = (
  session: SessionState,
  stage: FunnelStage,
  kind: string,
  detail: Record<string, unknown>,
): JourneyEvent => {
  const artifact: Artifact = {
    id: `${session.id}_${session.events.length}`,
    timestamp: new Date().toISOString(),
    type: kind,
    data: detail,
  };
  const soulmark = ledger.generateSoulmark(stage, artifact);
  return { id: artifact.id, at: artifact.timestamp, stage, kind, detail: { ...detail, signature: soulmark.signature } };
};

interface SessionStore {
  session: SessionState;
  /** Populated only when the safety screen fires; drives the routing screen. */
  safety: SafetySignal | null;
  /** Interventions already offered this session, so one is never repeated. */
  tried: string[];
  /** True when the classifier was unsure — the UI asks rather than assumes. */
  uncertain: boolean;

  submitStatement: (text: string) => void;
  correctPressure: (pressure: PressureId) => void;
  advance: (to: FunnelStage) => void;
  completeIntervention: () => void;
  reportShift: (shift: ShiftReport) => void;
  offerDecision: () => OfferDecision;
  acceptOffer: () => void;
  declineOffer: () => void;
  closeWithoutOffer: () => void;
  reset: () => void;
}

/** Routes a session to a pressure moment and binds its owning persona/exercise. */
const routeTo = (session: SessionState, pressure: PressureId, tried: string[]): SessionState => {
  const moment = getPressure(pressure);
  const intervention =
    nextIntervention(pressure, moment.support, tried) ?? interventionForPersona(moment.owner) ?? null;

  return {
    ...session,
    pressure,
    persona: intervention?.persona ?? moment.owner,
    intervention,
  };
};

export const useSession = create<SessionStore>((set, get) => ({
  session: newSession(),
  safety: null,
  tried: [],
  uncertain: false,

  submitStatement: (text) => {
    const statement = text.trim();
    if (!statement) return;

    const signal = screen(statement);

    // A safety signal halts the funnel outright. No classification, no exercise,
    // no offer — now or later in this session.
    if (signal.level === 'route') {
      set((s) => ({
        safety: signal,
        session: {
          ...s.session,
          statement,
          safetyRouted: true,
          outcome: 'ROUTED_TO_SUPPORT',
          events: [
            ...s.session.events,
            record(s.session, s.session.stage, 'SAFETY_ROUTED', {
              categories: signal.categories,
            }),
          ],
        },
      }));
      return;
    }

    const classification = classify(statement);
    set((s) => {
      const routed = routeTo({ ...s.session, statement }, classification.pressure, s.tried);
      return {
        uncertain: classification.confidence < LOW_CONFIDENCE,
        session: {
          ...routed,
          stage: 'REFLECTION',
          events: [
            ...routed.events,
            record(routed, 'REFLECTION', 'SIGNAL_CLASSIFIED', {
              pressure: classification.pressure,
              confidence: Number(classification.confidence.toFixed(2)),
              matched: classification.matched,
            }),
          ],
        },
      };
    });
  },

  correctPressure: (pressure) => {
    set((s) => {
      const routed = routeTo(s.session, pressure, s.tried);
      return {
        uncertain: false,
        session: {
          ...routed,
          events: [
            ...routed.events,
            record(routed, routed.stage, 'DOOR_CORRECTED', { pressure }),
          ],
        },
      };
    });
  },

  advance: (to) => {
    set((s) => ({
      session: {
        ...s.session,
        stage: to,
        events: [...s.session.events, record(s.session, to, 'STAGE_ENTERED', { from: s.session.stage })],
      },
    }));
  },

  completeIntervention: () => {
    set((s) => ({
      tried: s.session.intervention ? [...s.tried, s.session.intervention.id] : s.tried,
      session: {
        ...s.session,
        stage: 'CHECKPOINT',
        interventionCompleted: true,
        attempts: s.session.attempts + 1,
        events: [
          ...s.session.events,
          record(s.session, 'CHECKPOINT', 'INTERVENTION_COMPLETED', {
            intervention: s.session.intervention?.id,
            attempt: s.session.attempts + 1,
          }),
        ],
      },
    }));
  },

  reportShift: (shift) => {
    set((s) => {
      const next = stageAfterCheckpoint(shift, s.session.attempts);
      const withShift: SessionState = {
        ...s.session,
        shift,
        stage: next,
        // Feeling worse ends the session then and there — there is no further
        // stage to reach and nothing will be offered, so record that outcome
        // rather than leaving it open.
        outcome: shift === 'worse' ? 'COMPLETED_NO_OFFER' : s.session.outcome,
        events: [
          ...s.session.events,
          record(s.session, next, 'SHIFT_REPORTED', {
            shift,
            attempt: s.session.attempts,
            intervention: s.session.intervention?.id,
          }),
        ],
      };

      // "Nothing changed" and attempts remaining: bind a different exercise
      // rather than asking the same question again.
      if (next === 'ACTION' && withShift.pressure) {
        const moment = getPressure(withShift.pressure);
        const alt = nextIntervention(withShift.pressure, moment.support, s.tried);
        return {
          session: {
            ...withShift,
            intervention: alt ?? withShift.intervention,
            persona: alt?.persona ?? withShift.persona,
            interventionCompleted: false,
            shift: null,
          },
        };
      }

      return { session: withShift };
    });
  },

  offerDecision: () => evaluateOffer(get().session),

  acceptOffer: () => {
    set((s) => ({
      session: {
        ...s.session,
        stage: 'CONTINUATION',
        outcome: 'COMPLETED_WITH_OFFER',
        events: [
          ...s.session.events,
          record(s.session, 'CONTINUATION', 'OFFER_ACCEPTED', {
            // The one number the optimisation layer actually needs.
            attributedPersona: s.session.persona,
            attributedIntervention: s.session.intervention?.id,
            attempts: s.session.attempts,
          }),
        ],
      },
    }));
  },

  declineOffer: () => {
    set((s) => ({
      session: {
        ...s.session,
        outcome: 'DECLINED',
        events: [...s.session.events, record(s.session, s.session.stage, 'OFFER_DECLINED', {})],
      },
    }));
  },

  closeWithoutOffer: () => {
    set((s) => ({
      session: {
        ...s.session,
        outcome: 'COMPLETED_NO_OFFER',
        events: [
          ...s.session.events,
          record(s.session, s.session.stage, 'CLOSED_NO_OFFER', {
            attempts: s.session.attempts,
            maxAttempts: MAX_ATTEMPTS,
          }),
        ],
      },
    }));
  },

  reset: () => set({ session: newSession(), safety: null, tried: [], uncertain: false }),
}));
