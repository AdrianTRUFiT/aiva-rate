import { classify, getPressure } from '../../src/pw/pressure';
import { interventionForPersona } from '../../src/pw/interventions';
import { getPersona } from '../../src/pw/personas';
import type { Desk, Signal } from './types';

/**
 * AIOP — the intelligence step after DICE surfaces an opportunity.
 *
 * DICE says: here is someone worth understanding.
 * AIOP says: here is what they appear to be asking for, what this desk can
 * legitimately contribute, what we still do not know, and what to do next.
 *
 * Deterministic, like everything else that produces words in this codebase. An
 * operator can read why a recommendation was made, and a wrong one is fixable
 * by editing a rule rather than by re-prompting.
 */

export interface Recommendation {
  /** What the person appears to be asking for. */
  reading: string;
  /** What this desk can legitimately offer — never a pitch. */
  contribution: string;
  /** What we do not know and would need to know. */
  unknowns: string[];
  /** The recommended next action, in plain language. */
  nextAction: string;
  /** Whether AIOP thinks this is worth a human's time at all. */
  verdict: 'act' | 'watch' | 'pass';
  /** Why that verdict. */
  rationale: string;
}

const UNKNOWNS_BY_CONFIDENCE = (confidence: number): string[] =>
  confidence > 0.6
    ? []
    : ['What they actually want is ambiguous from the post — read the thread before replying.'];

export function recommend(desk: Desk, signal: Signal): Recommendation {
  const classified = classify(`${signal.title} ${signal.excerpt}`);
  const moment = getPressure(classified.pressure);
  const intervention = interventionForPersona(desk.id);
  const persona = getPersona(desk.id);

  const onLens = classified.pressure === desk.lens.pressure;
  const unknowns = [...UNKNOWNS_BY_CONFIDENCE(classified.confidence)];

  if (signal.scores.freshnessHours > 24) {
    unknowns.push('The thread is over a day old — check whether it has already been answered well.');
  }
  if (signal.excerpt.length < 200) {
    unknowns.push('Short post. There may be context in the comments that changes the read.');
  }

  /* ---- Verdict --------------------------------------------------------- */

  // Anything the policy layer refused is a pass, whatever it scored. This is
  // the same precedence as the inbound product: safety and permission first,
  // commercial judgement second.
  if (signal.state === 'do-not-contact' || signal.state === 'blocked') {
    return {
      reading: 'Screened out before assessment.',
      contribution: 'None. This person is not a prospect.',
      unknowns: [],
      nextAction: 'Leave it alone.',
      verdict: 'pass',
      rationale: signal.screenedReason ?? 'Screened out by policy.',
    };
  }

  if (signal.collision) {
    return {
      reading: moment.mechanism,
      contribution: 'Nothing yet — another desk is already here.',
      unknowns,
      nextAction: `Check what ${signal.collision.deskId} did before this desk touches it.`,
      verdict: 'pass',
      rationale: `${signal.collision.deskId} already engaged this ${signal.collision.on}.`,
    };
  }

  const verdict: Recommendation['verdict'] =
    !onLens ? 'pass' : signal.scores.priority >= 70 ? 'act' : signal.scores.priority >= 45 ? 'watch' : 'pass';

  const rationale = !onLens
    ? `Reads as "${moment.label}", which belongs to another desk. Routing it here would be a stretch.`
    : verdict === 'act'
      ? `On-lens, recent, and asking. Fit ${signal.scores.fit}, intent ${signal.scores.intent}.`
      : verdict === 'watch'
        ? `On-lens but weaker signal (priority ${signal.scores.priority}). Worth watching, not worth a reply today.`
        : `Priority ${signal.scores.priority} is below the bar for operator time.`;

  const canReply = signal.actions.reply.allowed;

  const nextAction = !onLens
    ? `Route to ${getPersona(moment.owner).name}'s desk instead of answering from here.`
    : verdict !== 'act'
      ? 'Leave in the queue. Nothing to send.'
      : canReply
        ? `Reply publicly with ${intervention?.name ?? persona.signatureMove} — the exercise itself, no link, no offer. If they come back, that is when anything else becomes appropriate.`
        : `Cannot reply here: ${signal.actions.reply.reason} Log the read and move on.`;

  return {
    reading: moment.mechanism,
    contribution: onLens && intervention
      ? `${intervention.name} — ${intervention.premise}`
      : 'Nothing this desk is built for.',
    unknowns,
    nextAction,
    verdict,
    rationale,
  };
}
