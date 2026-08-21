import { getPersona } from './personas';
import { getPressure } from './pressure';
import { interventionForPersona } from './interventions';
import type { Intervention, PersonaId, PressureId } from './types';

/**
 * The 7-Day Under Pressure Reset — what is actually being offered at the
 * transaction stage, and what the Continuity Guide runs afterwards.
 *
 * The plan adapts to the pressure the person came in with rather than being one
 * fixed curriculum: day one is always their own front door's exercise, then the
 * supporting personas, then the standard arc. Anything already covered is
 * skipped rather than repeated.
 */

/** The default arc once a person's own pressure and its support are exhausted. */
const STANDARD_ARC: PersonaId[] = [
  'regulator',
  'clarifier',
  'unraveler',
  'encourager',
  'architect',
  'rebuilder',
  'companion',
  'navigator',
  'continuity-guide',
];

export interface ResetDay {
  day: number;
  persona: PersonaId;
  focus: string;
  intervention: Intervention;
  /** The one-minute question asked at the end of that day. */
  checkIn: string;
}

const CHECK_INS = [
  'Out of ten, how was today? And one thing that went better than expected.',
  'What took the most out of you today, and was it worth it?',
  'Name one thing you did today that the version of you from last week could not have.',
  'What is still looping? Write it down here rather than carrying it to bed.',
  'What would make tomorrow 10% easier? Do that one thing.',
  'What has actually changed since day one? Be specific and be fair to yourself.',
  'What is worth keeping from this week, and what are you letting go of?',
];

/**
 * Builds the seven-day plan for a given pressure moment.
 *
 * Days 1–6 are drawn from the person's own front door, then its supporting
 * guides, then the standard arc, skipping anything already scheduled. Day 7 is
 * always the Continuity Guide, so it is held out of the pool rather than being
 * swapped in at the end — swapping could double-book a guide already used.
 *
 * That hold-out is also why someone whose own door is `continuation` starts on
 * their top supporting guide: their guide is waiting for them on day 7.
 */
export function buildResetPlan(pressure: PressureId): ResetDay[] {
  const moment = getPressure(pressure);
  const pool: PersonaId[] = [moment.owner, ...moment.support, ...STANDARD_ARC].filter(
    (p) => p !== 'continuity-guide',
  );

  const seen = new Set<PersonaId>();
  const days: ResetDay[] = [];

  for (const persona of pool) {
    if (days.length === 6) break;
    if (seen.has(persona)) continue;
    const intervention = interventionForPersona(persona);
    if (!intervention) continue;

    seen.add(persona);
    days.push({
      day: days.length + 1,
      persona,
      focus: getPersona(persona).fn,
      intervention,
      checkIn: CHECK_INS[days.length],
    });
  }

  // Continuation is the whole point of the week, so it always closes it.
  const guide = interventionForPersona('continuity-guide');
  if (guide) {
    days.push({
      day: days.length + 1,
      persona: 'continuity-guide',
      focus: getPersona('continuity-guide').fn,
      intervention: guide,
      checkIn: CHECK_INS[6],
    });
  }

  return days;
}

/** The offer itself. Terms stated plainly, because the doctrine depends on trust. */
export const RESET_OFFER = {
  name: '7-Day Under Pressure Reset',
  promise: 'One guided exercise a day and a one-minute check-in, shaped around what you came in with.',
  commitments: [
    'Seven days, then it ends on its own — there is nothing to cancel.',
    'Under ten minutes a day. Miss one and nothing resets.',
    'Every guide is an AI. You will never be told otherwise.',
    'Your words stay yours. Nothing you wrote is used to market anything back to you.',
  ],
  decline: 'No thanks — I got what I needed',
} as const;
