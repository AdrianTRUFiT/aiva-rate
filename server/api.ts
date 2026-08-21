import type { PersonaId, PressureId, ShiftReport } from '../src/pw/types';
import type { ResumeView } from './delivery';

/** Request and response shapes shared by the server and the browser client. */

/**
 * The evidence a browser submits when someone accepts the offer.
 *
 * The session itself never leaves the browser before this point — that is the
 * promise made on the threshold screen — so the gate has to be re-decided here
 * from what the client reports.
 */
export interface EnrollRequest {
  email: string;
  pressure: PressureId;
  persona: PersonaId;
  intervention: string;
  evidence: {
    interventionCompleted: boolean;
    shift: ShiftReport | null;
    attempts: number;
    safetyRouted: boolean;
  };
}

export interface EnrollResponse {
  enrollmentId: string;
  checkoutUrl: string;
  provider: 'stripe' | 'mock';
}

export interface CheckinRequest {
  day: number;
  rating: number | null;
  note: string;
}

export interface CheckinResponse {
  ok: true;
  view: ResumeView;
  /** Set when the note tripped the safety screen and delivery was paused. */
  routedToSupport?: boolean;
}

export interface ApiError {
  error: string;
  /** Present when an offer or enrolment was refused by the gate. */
  gate?: string;
}

export type { ResumeView };
