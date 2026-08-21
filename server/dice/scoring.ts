import { classify } from '../../src/pw/pressure';
import type { Desk, RawSignal, SignalScores } from './types';

/**
 * Fit, intent, and recency.
 *
 * All three are computed from readable rules rather than a model, for the same
 * reason the inbound classifier is: an operator looking at a card ranked 92
 * should be able to find out exactly why, and a bad ranking should be fixable
 * by editing a list.
 */

/** Below this a signal is not worth an operator's attention. */
export const RELEVANT_THRESHOLD = 45;
/** Above this it goes in the strong pile. */
export const STRONG_THRESHOLD = 70;
/**
 * Above this it surfaces in today's priority queue.
 *
 * Set from the top of the realistic range rather than a round number: a post
 * that is on-lens, explicitly asking, and a couple of hours old scores in the
 * high seventies, and that is the best case worth acting on. A threshold above
 * it would produce an empty queue every morning, which is the failure mode
 * that makes an operator stop opening the tool.
 */
export const PRIORITY_THRESHOLD = 75;

/** Phrases that indicate someone is actually asking, not just venting. */
const ASKING = [
  'what should i do', 'what do i do', 'any advice', 'advice?', 'how do i',
  'how do you', 'has anyone', 'anyone else', 'looking for', 'need help',
  'help me', 'suggestions', 'recommendations', 'tips', 'where do i start',
  'not sure what', "don't know how", 'struggling with', 'trying to figure',
];

/** Phrases that mean this is not a person with a problem. */
const NOT_A_PERSON = [
  'discount code', 'affiliate', 'dm me for', 'check out my', 'my newsletter',
  'link in bio', 'sign up here', 'promo', 'giveaway', 'upvote',
  'i built', 'i made a', 'launching', 'beta testers', 'survey for my',
];

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'");

const hits = (text: string, phrases: string[]): string[] =>
  phrases.filter((p) => text.includes(p));

export interface ScoreResult {
  scores: SignalScores;
  reasons: string[];
  /** Set when the post is promotional or bot-like rather than a real person. */
  commercial: boolean;
}

export function scoreSignal(desk: Desk, raw: RawSignal, now: Date): ScoreResult {
  const text = norm(`${raw.title}\n${raw.body}`);
  const reasons: string[] = [];

  /* ---- Fit: does this match the desk's lens? -------------------------- */
  const keywordHits = hits(text, desk.lens.keywords.map(norm));
  const exclusionHits = hits(text, desk.lens.exclusions.map(norm));

  // The inbound classifier is reused directly: if it routes this text to the
  // same pressure moment the desk covers, that is the strongest fit evidence
  // available and it is the same logic the product uses on its own users.
  const classified = classify(`${raw.title} ${raw.body}`);
  const pressureMatch = classified.pressure === desk.lens.pressure && classified.confidence > 0;

  let fit = 0;
  if (pressureMatch) {
    fit += 45 + Math.round(classified.confidence * 25);
    reasons.push(`Reads as "${classified.pressure}", which is this desk's front door.`);
  } else if (classified.confidence > 0) {
    fit += 10;
    reasons.push(`Reads as "${classified.pressure}" — another desk's lens.`);
  }

  if (keywordHits.length) {
    fit += Math.min(30, keywordHits.length * 12);
    reasons.push(`Matched desk keywords: ${keywordHits.slice(0, 3).join(', ')}.`);
  }

  if (exclusionHits.length) {
    fit -= 40;
    reasons.push(`Hit desk exclusions: ${exclusionHits.join(', ')}.`);
  }

  const subredditListed = desk.lens.subreddits.some(
    (s) => s.replace(/^r\//i, '').toLowerCase() === raw.subreddit.toLowerCase(),
  );
  if (subredditListed) {
    fit += 10;
    reasons.push(`Posted in r/${raw.subreddit}, one of this desk's communities.`);
  }

  /* ---- Intent: are they asking for help? ------------------------------ */
  const askHits = hits(text, ASKING);
  const commercialHits = hits(text, NOT_A_PERSON);

  // Calibrated so a post that is on-lens, explicitly asking, and written at
  // length clears the priority bar, while one that merely vents does not.
  // A venting post is still a real person — it lands in `relevant`, where an
  // operator can read it — it just is not what you spend today on.
  let intent = 30;
  if (askHits.length) {
    intent += Math.min(45, askHits.length * 25);
    reasons.push(`Asking directly: "${askHits[0]}".`);
  }
  if (text.includes('?')) intent += 10;

  // A wall of text is usually someone working something out; a one-liner is
  // usually not enough to respond to usefully.
  if (raw.body.length > 400) {
    intent += 12;
    reasons.push('Wrote at length — enough context to respond usefully.');
  } else if (raw.body.length < 80) {
    intent -= 25;
    reasons.push('Very short post — little to work with.');
  }

  const commercial = commercialHits.length > 0;
  if (commercial) {
    intent -= 60;
    reasons.push(`Looks promotional rather than personal: "${commercialHits[0]}".`);
  }

  /* ---- Recency -------------------------------------------------------- */
  const freshnessHours = Math.max(
    0,
    (now.getTime() - new Date(raw.createdAt).getTime()) / 3_600_000,
  );

  // Usefulness decays fast. A day-old post about a layoff has usually already
  // been answered, and arriving late reads worse than not arriving.
  const recencyFactor =
    freshnessHours <= 3 ? 1 : freshnessHours <= 12 ? 0.85 : freshnessHours <= 48 ? 0.6 : 0.3;

  if (freshnessHours <= 3) reasons.push(`Posted ${Math.round(freshnessHours)}h ago — still live.`);
  else if (freshnessHours > 48) reasons.push(`${Math.round(freshnessHours / 24)} days old — likely stale.`);

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const fitScore = clamp(fit);
  const intentScore = clamp(intent);

  return {
    scores: {
      fit: fitScore,
      intent: intentScore,
      freshnessHours: Math.round(freshnessHours * 10) / 10,
      priority: clamp((fitScore * 0.5 + intentScore * 0.5) * recencyFactor),
    },
    reasons,
    commercial,
  };
}

/**
 * A stable key for deduplication.
 *
 * Two desks finding the same post, and the same post arriving twice across
 * discovery runs, both collapse to one signal.
 */
export const dedupeKey = (raw: RawSignal): string =>
  `${raw.subreddit.toLowerCase()}:${raw.postId}`;
