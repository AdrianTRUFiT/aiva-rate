import type { PressureId, PressureMoment } from './types';

/**
 * The pressure taxonomy — the front doors.
 *
 * Ten doors, one engine behind them. A person never picks a door from a menu;
 * they say what is happening and the classifier picks it for them, then says
 * out loud which one it picked so they can correct it.
 */
export const PRESSURE_MOMENTS: Record<PressureId, PressureMoment> = {
  'sudden-shock': {
    id: 'sudden-shock',
    label: 'Something just hit',
    cues: [
      'laid off', 'let go', 'fired', 'lost my job', 'made redundant', 'redundancy',
      'just found out', 'just got', 'blindsided', 'out of nowhere', 'happened today',
      'broke up with me', 'left me', 'she left', 'he left', 'they left me',
      'bad news', 'diagnosis', 'passed away', 'died', 'panicking', 'freaking out',
      'panic', 'in shock', 'shaking',
    ],
    mechanism:
      'When something lands suddenly, the mind tries to solve the entire future at once. Everything arrives at the same priority level because nothing has been sorted yet.',
    owner: 'stabilizer',
    support: ['clarifier', 'companion'],
  },

  overwhelm: {
    id: 'overwhelm',
    label: 'Everything at once',
    cues: [
      'overwhelmed', 'overwhelming', 'too much', 'everything at once', 'all at once',
      'drowning', 'buried', 'so much to do', 'no idea where to start',
      "don't know where to start", 'piling up', 'juggling', 'stretched thin',
      'falling behind', 'behind on everything',
    ],
    mechanism:
      'Overwhelm is not a volume problem, it is a sorting problem. Undifferentiated tasks all feel equally urgent, so none of them can be started.',
    owner: 'clarifier',
    support: ['regulator', 'architect'],
  },

  isolation: {
    id: 'isolation',
    label: 'Carrying it alone',
    cues: [
      'alone', 'lonely', 'loneliness', 'no one to talk to', 'nobody to talk to',
      'no one understands', 'isolated', 'by myself', 'no support',
      'no friends', 'disconnected', 'invisible', 'nobody notices', 'nobody cares',
    ],
    mechanism:
      'Carrying something without a witness makes it heavier than it is. The isolation becomes a second problem stacked on the first one.',
    owner: 'companion',
    support: ['encourager', 'continuity-guide'],
  },

  'identity-disruption': {
    id: 'identity-disruption',
    label: 'Who I was is gone',
    cues: [
      'divorce', 'divorced', 'separating', 'separation', 'marriage ended',
      'failed', 'failure', 'humiliated', 'embarrassed', 'ashamed',
      "don't know who i am", 'not myself', 'lost myself', 'starting over',
      'start over', 'everything i built', 'wasted years',
    ],
    mechanism:
      'When a role ends, the daily structure that held your sense of self ends with it. That is a structural loss, not a character flaw.',
    owner: 'rebuilder',
    support: ['companion', 'architect'],
  },

  'decision-paralysis': {
    id: 'decision-paralysis',
    label: 'I cannot decide',
    cues: [
      "don't know what to do", 'do not know what to do', 'cant decide', "can't decide",
      'stuck between', 'two options', 'crossroads', 'should i',
      'what should i do', 'torn between', 'go back and forth', 'paralysed',
      'paralyzed', 'big decision', 'major decision', 'accept the offer',
    ],
    mechanism:
      'A decision stalls when the real cost of each path has never been said out loud. The mind keeps re-running the comparison because it never gets to finish it.',
    owner: 'navigator',
    support: ['clarifier', 'unraveler'],
  },

  burnout: {
    id: 'burnout',
    label: 'Running on empty',
    cues: [
      'burned out', 'burnt out', 'burnout', 'exhausted', 'exhaustion', 'depleted',
      'no energy', 'running on empty', 'cannot keep going', "can't keep going",
      'dread', 'dreading work', 'nothing left', 'wrung out', 'stressed',
      'stress', 'tense', 'chest is tight', "can't relax",
    ],
    mechanism:
      'Sustained load keeps the nervous system in gear long after the threat is gone. Until arousal comes down, clear thinking is not physically available.',
    owner: 'regulator',
    support: ['architect', 'clarifier'],
  },

  'new-beginning': {
    id: 'new-beginning',
    label: 'Starting something new',
    cues: [
      'starting college', 'started college', 'first year', 'freshman', 'university',
      'new job', 'first day', 'new role', 'starting a business', 'moved to',
      'just moved', 'new city', 'new chapter', 'about to start', 'orientation',
    ],
    mechanism:
      'A new environment removes every automatic routine at once. The fatigue is from making hundreds of small decisions that used to be free.',
    owner: 'architect',
    support: ['encourager', 'continuity-guide'],
  },

  'racing-thoughts': {
    id: 'racing-thoughts',
    label: 'My mind will not stop',
    cues: [
      'racing thoughts', 'mind racing', "can't shut my mind off", 'cannot shut off',
      "can't stop thinking", 'overthinking', 'ruminating', 'rumination',
      'spiralling', 'spiraling', 'looping', 'in my head', 'cannot sleep',
      "can't sleep", 'lying awake', '3am', 'wont stop', "won't switch off",
    ],
    mechanism:
      'A loud mind is usually several unfinished threads braided together. It keeps cycling because none of them has been named and set down.',
    owner: 'unraveler',
    support: ['regulator', 'clarifier'],
  },

  'self-doubt': {
    id: 'self-doubt',
    label: 'I do not think I can',
    cues: [
      'not good enough', 'not smart enough', 'imposter', 'impostor', 'fraud',
      'doubt myself', 'self doubt', 'no confidence', 'lost my confidence',
      'afraid to fail', 'scared to fail', 'what if i fail', 'everyone else is',
      'behind everyone', 'not qualified', 'talked myself out',
    ],
    mechanism:
      'Doubt survives on missing evidence. The brain files past capability under "that was different" and stops counting it.',
    owner: 'encourager',
    support: ['rebuilder', 'navigator'],
  },

  continuation: {
    id: 'continuation',
    label: 'Keeping it going',
    cues: [
      'staying on track', 'keep it going', 'keep going', 'check in', 'checking in',
      'day 3', 'day 4', 'kept it up', 'slipped', 'fell off', 'lost momentum',
      'back on track', 'still doing',
    ],
    mechanism:
      'Momentum breaks at the point where the original pressure fades and nothing has replaced it. Continuation is a smaller, different problem from starting.',
    owner: 'continuity-guide',
    support: ['architect', 'encourager'],
  },
};

export const PRESSURE_ORDER: PressureId[] = [
  'sudden-shock',
  'overwhelm',
  'isolation',
  'identity-disruption',
  'decision-paralysis',
  'burnout',
  'new-beginning',
  'racing-thoughts',
  'self-doubt',
  'continuation',
];

export interface Classification {
  pressure: PressureId;
  /** 0–1. Below LOW_CONFIDENCE the UI asks the person to confirm the door. */
  confidence: number;
  /** The cues that actually fired, for transparency and for tuning. */
  matched: string[];
  /** Runners-up, so the UI can offer "actually, it's more like…". */
  alternatives: PressureId[];
}

export const LOW_CONFIDENCE = 0.34;

/** Default door when nothing matches: being heard is never the wrong first move. */
const DEFAULT_PRESSURE: PressureId = 'isolation';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Matches a cue on word boundaries so "fired" does not fire on "firedrill" and
 * "alone" does not fire on "along". Apostrophes are normalised first because
 * people type both "can't" and "cant".
 */
const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const cueHits = (text: string, cues: string[]): string[] =>
  cues.filter((cue) => new RegExp(`(^|[^a-z0-9])${escape(cue)}([^a-z0-9]|$)`, 'i').test(text));

/**
 * Classifies a person's own words into a pressure moment.
 *
 * Deliberately deterministic and inspectable: a keyword-scored classifier that
 * can be read, tested, and corrected. A model can be layered on top later, but
 * the routing decision for someone in distress should be explainable without one.
 */
export function classify(statement: string): Classification {
  const text = normalise(statement);
  if (!text) {
    return { pressure: DEFAULT_PRESSURE, confidence: 0, matched: [], alternatives: [] };
  }

  const scored = PRESSURE_ORDER.map((id) => {
    const matched = cueHits(text, PRESSURE_MOMENTS[id].cues);
    // Longer cues are more specific, so they carry more weight than single words.
    const score = matched.reduce((sum, cue) => sum + 1 + cue.split(' ').length * 0.5, 0);
    return { id, matched, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (top.score === 0) {
    return { pressure: DEFAULT_PRESSURE, confidence: 0, matched: [], alternatives: [] };
  }

  const total = scored.reduce((sum, s) => sum + s.score, 0);
  const alternatives = scored.slice(1).filter((s) => s.score > 0).slice(0, 2).map((s) => s.id);

  return {
    pressure: top.id,
    confidence: Math.min(1, top.score / total),
    matched: top.matched,
    alternatives,
  };
}

export const getPressure = (id: PressureId): PressureMoment => PRESSURE_MOMENTS[id];
