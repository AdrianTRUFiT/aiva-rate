import { getPersona } from './personas';
import { getPressure } from './pressure';
import { SOULHOST } from './soulhost';
import type {
  Channel,
  ContentFormat,
  Intervention,
  PersonaId,
  PressureId,
} from './types';

/**
 * Persona prompt assembly.
 *
 * Two outputs, one source of truth:
 *
 *  1. `buildPrompt` produces the copy-paste-ready prompt an operator (or a
 *     generation service) uses to draft content in a persona's voice.
 *  2. `compose` produces the actual in-product response deterministically, with
 *     no model call. That matters more than it looks: the words a person in
 *     distress reads should be reviewable in advance, not generated fresh on
 *     every load.
 */

export interface PromptSpec {
  persona: PersonaId;
  pressure: PressureId;
  /** The person's own words, or a representative statement for content work. */
  statement: string;
  channel: Channel;
  format: ContentFormat;
  /** How many varied drafts to request. */
  variants?: number;
}

const FORMAT_BRIEFS: Record<ContentFormat, string> = {
  'long-form':
    '3–7 minutes of spoken script. Open on the pressure moment, not on a greeting. Walk through the exercise in real time so it can be followed while watching.',
  'short-form':
    '15–45 seconds. One sentence hook naming the pressure, the compressed exercise, one line inviting the person to notice what changed. On-screen text for every step.',
  carousel:
    'Six slides. Slide 1 the pressure hook, slides 2–3 empathy and what is happening internally, slides 4–5 the exercise steps, slide 6 what to do next.',
  thread:
    'Five to seven posts. Post 1 the hook, 2–3 the understanding, 4–5 the steps, final post the invitation. Each post has to stand alone if it is screenshotted.',
  article:
    '800–1200 words. Lead with the situation, name the mechanism, teach the exercise, close on what continued support looks like.',
  'check-in':
    'Under 60 words. One question, one small observation, no agenda. If there is nothing to say, say less.',
};

const TONE_RULES = [
  'Do not open with a greeting or the person’s situation restated back at them verbatim.',
  'No diagnosis, no clinical language, no promises about outcomes.',
  'No urgency, no scarcity, no selling anywhere before the final line.',
  'Short sentences. Concrete nouns. Nothing that sounds like a wellness brochure.',
  'Never claim to be human, and never imply a lived experience you do not have.',
];

const VARIATION_RULES = [
  'Vary the hook, the metaphor, and the order of the steps between variants.',
  'Do not reuse a phrase from a previous variant in the same batch.',
  'Keep the exercise itself identical in substance — only the framing changes.',
];

export function buildPrompt(spec: PromptSpec, intervention?: Intervention): string {
  const persona = getPersona(spec.persona);
  const pressure = getPressure(spec.pressure);
  const variants = spec.variants ?? 3;

  const steps = intervention
    ? intervention.steps.map((s, i) => `   ${i + 1}. ${s.instruction} (${s.seconds}s) — ${s.detail ?? ''}`.trimEnd())
    : ['   (no intervention bound — use the persona signature move)'];

  return [
    `# IDENTITY`,
    `You are ${persona.name}, a named guide within the Performance Wellness system.`,
    `You are an AI. This is disclosed to the reader and you never contradict it.`,
    ``,
    `Voice: ${persona.voice.join(', ')}.`,
    `Function: ${persona.fn}`,
    `Characteristic register (do not quote these verbatim):`,
    ...persona.tone.map((t) => `  · "${t}"`),
    ``,
    `# PRESSURE MOMENT`,
    `Front door: ${pressure.label}`,
    `What the person said: "${spec.statement}"`,
    `What is happening internally: ${pressure.mechanism}`,
    ``,
    `# BRIEF`,
    `Channel: ${spec.channel}`,
    `Format: ${spec.format}`,
    FORMAT_BRIEFS[spec.format],
    ``,
    `# REQUIRED STRUCTURE`,
    `1. Empathy — acknowledge the state without performing sympathy.`,
    `2. Understanding — say what is happening internally, plainly.`,
    `3. Education — one idea they can keep, in a sentence or two.`,
    `4. The exercise — ${intervention?.name ?? persona.signatureMove}:`,
    ...steps,
    `5. Invite them to notice what changed. "${intervention?.checkpointQuestion ?? 'Notice whether anything shifted.'}"`,
    `6. Continuation bridge — offered only as a next step, never as a pitch.`,
    ``,
    `# TONE RULES`,
    ...TONE_RULES.map((r) => `- ${r}`),
    ``,
    `# OUTPUT`,
    `Produce ${variants} variants.`,
    ...VARIATION_RULES.map((r) => `- ${r}`),
  ].join('\n');
}

/* ------------------------------------------------------------------------- */
/* Deterministic in-product composition                                       */
/* ------------------------------------------------------------------------- */

/**
 * Empathy lines, written per pressure moment rather than generated. Two things
 * they are not: a restatement of what the person said, and reassurance that it
 * will be fine.
 */
const EMPATHY: Record<PressureId, string> = {
  'sudden-shock':
    'Of course your mind is going everywhere at once. That is what minds do when something lands without warning.',
  overwhelm:
    'When it is all arriving at the same time, none of it gets to be small. That is genuinely hard to think through.',
  isolation:
    'Carrying something without anyone knowing about it is its own separate weight, on top of the first one.',
  'identity-disruption':
    'Something you organised your days around has changed shape. It makes sense that you feel unsteady.',
  'decision-paralysis':
    'Going back and forth is not indecision. It usually means both paths cost you something real.',
  burnout:
    'Being this depleted is not a discipline problem. You have been running on a system that was not designed to stay on this long.',
  'new-beginning':
    'Everything being new at once is exhausting in a way that is easy to underestimate.',
  'racing-thoughts':
    'A mind that will not settle is tiring in a way that rest does not fix.',
  'self-doubt':
    'That voice is loud right now, and loud is not the same as accurate.',
  continuation:
    'Keeping something going once the initial pressure fades is a different job from starting it.',
};

/** The grounding reframe — one line that changes the size of the problem. */
const REFRAME: Record<PressureId, string> = {
  'sudden-shock': 'You do not have to solve your whole future tonight.',
  overwhelm: 'You are not behind. You are unsorted, and that is fixable in about three minutes.',
  isolation: 'Being unseen is a circumstance, not a verdict on you.',
  'identity-disruption': 'The skills did not leave with the situation.',
  'decision-paralysis': 'You do not need certainty. You need the next step.',
  burnout: 'Nothing gets decided well from this state. Down-shift first.',
  'new-beginning': 'You do not need a system for the year. You need three fixed points for the week.',
  'racing-thoughts': 'It is almost never as many thoughts as it feels like.',
  'self-doubt': 'Confidence follows evidence. It does not arrive ahead of it.',
  continuation: 'Missing a day is not a relapse.',
};

export interface ComposedResponse {
  empathy: string;
  understanding: string;
  reframe: string;
  education: string;
  bridge: string;
}

/**
 * Builds the in-product response for a session. Every string is either written
 * by hand above or drawn from the reviewed pressure/persona records, so the
 * full set of things this system can say to someone is enumerable.
 */
export function compose(
  personaId: PersonaId,
  pressureId: PressureId,
  intervention: Intervention,
): ComposedResponse {
  const pressure = getPressure(pressureId);

  // personaId is what selected this copy and this exercise, and it is what the
  // ledger attributes the session to — but it is deliberately not named to the
  // person. SoulHost is the voice; the guides work behind it. See soulhost.ts.
  void personaId;

  return {
    empathy: EMPATHY[pressureId],
    understanding: pressure.mechanism,
    reframe: REFRAME[pressureId],
    education: intervention.premise,
    bridge: SOULHOST.handoff(
      intervention.name,
      Math.max(1, Math.round(intervention.durationSeconds / 60)),
    ),
  };
}
