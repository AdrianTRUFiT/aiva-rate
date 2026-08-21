import { buildResetPlan, type ResetDay } from '../src/pw/continuity';
import type { Enrollment } from './store/types';

/**
 * When each day of the reset becomes due.
 *
 * Purely time-based from the moment payment confirmed: day N unlocks at
 * startedAt + (N-1) × 24h. Completion of the previous day is deliberately not
 * a precondition, because the offer promises "miss one and nothing resets" —
 * gating on completion would quietly turn a supportive week into a streak
 * mechanic, which is the failure mode this product is supposed to avoid.
 */

export const PLAN_LENGTH = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

/** The day number currently unlocked, clamped to the plan. Null if not started. */
export function currentDay(enrollment: Enrollment, now: Date): number | null {
  if (!enrollment.startedAt) return null;
  const elapsed = now.getTime() - new Date(enrollment.startedAt).getTime();
  if (elapsed < 0) return 1; // clock skew: never hide day 1
  return Math.min(PLAN_LENGTH, Math.floor(elapsed / DAY_MS) + 1);
}

/** Every day that has unlocked but has not yet been delivered. */
export function pendingDeliveries(enrollment: Enrollment, now: Date): number[] {
  if (enrollment.status !== 'active') return [];
  const unlocked = currentDay(enrollment, now);
  if (unlocked === null) return [];

  const sent = new Set(enrollment.deliveries.map((d) => d.day));
  const pending: number[] = [];
  for (let day = 1; day <= unlocked; day++) {
    if (!sent.has(day)) pending.push(day);
  }
  return pending;
}

/** True once every day has been delivered and the last one has unlocked. */
export function isComplete(enrollment: Enrollment, now: Date): boolean {
  return currentDay(enrollment, now) === PLAN_LENGTH &&
    enrollment.deliveries.length >= PLAN_LENGTH;
}

/** The plan for an enrolment, rebuilt from its pressure moment. */
export const planFor = (enrollment: Enrollment): ResetDay[] => buildResetPlan(enrollment.pressure);

export function dayOf(enrollment: Enrollment, day: number): ResetDay | null {
  return planFor(enrollment).find((d) => d.day === day) ?? null;
}

/** When day N unlocks, for showing "your next one opens at…". */
export function unlocksAt(enrollment: Enrollment, day: number): Date | null {
  if (!enrollment.startedAt) return null;
  return new Date(new Date(enrollment.startedAt).getTime() + (day - 1) * DAY_MS);
}

/**
 * What a returning person sees: the unlocked day, their progress, and when the
 * next one opens. Deliberately derived rather than stored, so a stored day
 * counter can never drift out of step with the calendar.
 */
export interface ResumeView {
  enrollmentId: string;
  /** Server time. The client renders every countdown against this, not its own
      clock, which is routinely wrong by minutes and occasionally by days. */
  now: string;
  status: Enrollment['status'];
  pressure: Enrollment['pressure'];
  currentDay: number | null;
  nextUnlocksAt: string | null;
  completedDays: number[];
  plan: { day: number; intervention: string; focus: string; checkIn: string; locked: boolean }[];
}

export function resumeView(enrollment: Enrollment, now: Date): ResumeView {
  const unlocked = currentDay(enrollment, now);
  const next = unlocked !== null && unlocked < PLAN_LENGTH ? unlocksAt(enrollment, unlocked + 1) : null;

  return {
    enrollmentId: enrollment.id,
    now: now.toISOString(),
    status: enrollment.status,
    pressure: enrollment.pressure,
    currentDay: unlocked,
    nextUnlocksAt: next?.toISOString() ?? null,
    completedDays: enrollment.days.filter((d) => d.completedAt).map((d) => d.day),
    plan: planFor(enrollment).map((d) => ({
      day: d.day,
      intervention: d.intervention.name,
      focus: d.focus,
      checkIn: d.checkIn,
      locked: unlocked === null || d.day > unlocked,
    })),
  };
}
