import { PERSONA_ORDER, getPersona } from '../../src/pw/personas';
import { authStatusFor, configuredLimits, grantsFor, limitsFor } from './credentials';
import { mergeLens, type LensOverride } from './lens';
import type { Desk, DeskId, DeskLens } from './types';

/**
 * The ten desks.
 *
 * Each is one company-operated Reddit identity with its own listening lens.
 * The lenses are deliberately disjoint: they are different ways of hearing the
 * market, not ten accounts pointed at the same posts. That is what makes ten
 * desks a legitimate agency rather than a pile-on.
 *
 * Identity lives here. Credentials live in credentials.ts. The only thing that
 * crosses between them is an auth status.
 */

/** Public handles. Placeholders until the real accounts are mapped. */
const HANDLES: Record<DeskId, string> = {
  stabilizer: 'u/steady_reset',
  clarifier: 'u/two_column_sort',
  companion: 'u/plainly_heard',
  rebuilder: 'u/small_proof',
  navigator: 'u/three_paths',
  regulator: 'u/downshift_daily',
  architect: 'u/first_seven_days',
  unraveler: 'u/one_thread_out',
  encourager: 'u/evidence_not_hype',
  'continuity-guide': 'u/one_minute_checkin',
};

/**
 * Per-desk listening lenses.
 *
 * Subreddits listed here are candidates, not permissions. Every one is checked
 * against the policy blocklist before discovery, and a blocked entry is refused
 * rather than searched — see policy.searchableSubreddits.
 */
const LENSES: Record<DeskId, Omit<DeskLens, 'pressure'>> = {
  stabilizer: {
    subreddits: ['layoffs', 'jobs', 'antiwork'],
    keywords: ['laid off', 'let go', 'fired', 'severance', 'blindsided', 'just found out'],
    exclusions: ['hiring', 'recruiter', 'salary negotiation', 'resume review'],
  },
  clarifier: {
    subreddits: ['productivity', 'getdisciplined', 'overemployed'],
    keywords: ['overwhelmed', 'too much', 'where to start', 'piling up', 'juggling'],
    exclusions: ['app recommendation', 'best tool', 'notion template'],
  },
  companion: {
    subreddits: ['selfimprovement', 'decidingtobebetter'],
    keywords: ['no one to talk to', 'feel alone', 'isolated', 'nobody notices'],
    exclusions: ['dating advice', 'relationship advice', 'am i the asshole'],
  },
  rebuilder: {
    subreddits: ['careerguidance', 'jobs'],
    keywords: ['starting over', 'lost my confidence', 'failed', 'wasted years'],
    exclusions: ['divorce lawyer', 'custody', 'settlement'],
  },
  navigator: {
    subreddits: ['careerguidance', 'jobs'],
    keywords: ['cant decide', 'two offers', 'crossroads', 'should i take', 'torn between'],
    exclusions: ['which laptop', 'which car', 'which city'],
  },
  regulator: {
    subreddits: ['antiwork', 'workreform', 'productivity'],
    keywords: ['burned out', 'burnt out', 'exhausted', 'no energy', 'dreading work'],
    exclusions: ['supplement', 'nootropic', 'medication', 'diagnosis'],
  },
  architect: {
    subreddits: ['college', 'gradschool', 'studytips'],
    keywords: ['starting college', 'first year', 'new job', 'first day', 'no routine'],
    exclusions: ['which major', 'admissions', 'application essay', 'scholarship'],
  },
  unraveler: {
    subreddits: ['getdisciplined', 'selfimprovement'],
    keywords: ['racing thoughts', 'overthinking', 'cant switch off', 'lying awake'],
    exclusions: ['insomnia medication', 'sleep apnea', 'therapist recommendation'],
  },
  encourager: {
    subreddits: ['getmotivated', 'decidingtobebetter', 'college'],
    keywords: ['imposter', 'not good enough', 'doubt myself', 'scared to fail'],
    exclusions: ['motivational quote', 'transformation photo', 'progress pic'],
  },
  'continuity-guide': {
    subreddits: ['getdisciplined', 'selfimprovement'],
    keywords: ['fell off', 'lost momentum', 'back on track', 'day 4', 'keep it going'],
    exclusions: ['streak', 'nofap', 'challenge'],
  },
};

/**
 * Builds a desk. Auth status, grants, and limits are resolved from the
 * credential store at call time so a reconnect is reflected without a restart.
 *
 * `simulate` is passed when the fixture source is in use and this desk has no
 * real credentials. It grants read and comment so the operator workflow can be
 * walked end to end, marks the desk `simulated: true`, and still withholds the
 * message grant — simulating a capability the policy has decided not to have
 * would teach an operator the wrong thing about what this system does.
 */
export function buildDesk(id: DeskId, simulate = false, lensOverride: LensOverride | null = null): Desk {
  const persona = getPersona(id);
  const auth = authStatusFor(id);
  const configured = auth !== 'not-configured';
  const simulated = simulate && !configured;

  return {
    id,
    persona: id,
    handle: HANDLES[id],
    auth: simulated ? 'connected' : auth,
    simulated,
    grants: simulated ? { read: true, comment: true, message: false } : grantsFor(id),
    // A configured limit always wins, including in simulation.
    limits:
      configuredLimits(id) ??
      (simulated ? { requestsPerWindow: SIMULATED_LIMITS[id], windowSeconds: 3600 } : limitsFor(id)),
    // Shipped defaults, with the operator's edits layered over them.
    lens: mergeLens({ ...LENSES[id], pressure: persona.pressure }, lensOverride),
  };
}

/** The shipped defaults for a desk, before any operator edit. */
export const defaultLens = (id: DeskId): DeskLens => ({
  ...LENSES[id],
  pressure: getPersona(id).pressure,
});

/**
 * Limits the fixture emulates per desk. Deliberately different from each other
 * so "each desk has its own budget" is visible in the console rather than
 * being a claim in a comment.
 */
const SIMULATED_LIMITS: Record<DeskId, number> = {
  stabilizer: 600,
  clarifier: 250,
  companion: 300,
  rebuilder: 200,
  navigator: 250,
  regulator: 700,
  architect: 650,
  unraveler: 400,
  encourager: 300,
  'continuity-guide': 150,
};

export const allDesks = (simulate = false): Desk[] =>
  PERSONA_ORDER.map((id) => buildDesk(id, simulate));

export const DESK_IDS: DeskId[] = [...PERSONA_ORDER];

export const isDeskId = (value: string): value is DeskId =>
  (DESK_IDS as string[]).includes(value);
