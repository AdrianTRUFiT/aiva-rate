import type { PersonaId, PressureId } from '../../src/pw/types';

/**
 * What is persisted, and — more importantly — what is not.
 *
 * The threshold statement, the words a person types when they first arrive, is
 * never stored server-side. Only the derived routing decision is. That keeps
 * the promise made on the threshold screen literally true: the journey up to
 * the point of enrolment stays in the browser.
 *
 * Check-in notes ARE stored, because they are the person's own log and they
 * get them back. They are never used for anything else.
 */

export type EnrollmentStatus =
  | 'pending_payment'
  | 'active'
  | 'paused_safety'
  | 'completed'
  | 'cancelled';

export interface DayRecord {
  day: number;
  completedAt: string | null;
  /** The person's own words at the daily check-in. Shown back to them only. */
  note: string | null;
  rating: number | null;
}

export interface DeliveryRecord {
  day: number;
  sentAt: string;
  channel: 'email';
  messageId: string;
}

export interface Enrollment {
  id: string;
  createdAt: string;

  /** Derived routing state — never the raw statement. */
  pressure: PressureId;
  /** Which guide and exercise earned the transaction. */
  entryPersona: PersonaId;
  entryIntervention: string;

  email: string;
  status: EnrollmentStatus;

  payment: {
    provider: 'stripe' | 'mock';
    checkoutId: string | null;
    paidAt: string | null;
    amountCents: number;
    currency: string;
  };

  /** Set when payment confirms. Day 1 is due immediately from here. */
  startedAt: string | null;

  days: DayRecord[];
  deliveries: DeliveryRecord[];

  /** SHA-256 of the resume token. The token itself is never stored. */
  resumeTokenHash: string;

  /** Set when a check-in trips the safety screen. */
  safety: { pausedAt: string; categories: string[] } | null;
}

export interface EnrollmentRepository {
  create(enrollment: Enrollment): Promise<Enrollment>;
  get(id: string): Promise<Enrollment | null>;
  findByResumeTokenHash(hash: string): Promise<Enrollment | null>;
  findByCheckoutId(checkoutId: string): Promise<Enrollment | null>;
  /** Applies a mutation atomically so concurrent webhooks cannot clobber. */
  update(id: string, mutate: (e: Enrollment) => Enrollment): Promise<Enrollment>;
  /** Every active enrolment, for the delivery sweep. */
  active(): Promise<Enrollment[]>;
}
