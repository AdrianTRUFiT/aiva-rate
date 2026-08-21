import type { Intervention, InterventionStep, PersonaId, PressureId } from './types';

/**
 * The micro-intervention library.
 *
 * Every one of these is short enough to finish in a hallway, specific enough
 * that the person can tell whether it worked, and free. The whole commercial
 * thesis rests on these being genuinely useful before anything is offered.
 *
 * None of it is treatment. Each one is a self-regulation or sorting exercise of
 * the kind a person could be talked through by a level-headed friend.
 */

const build = (
  spec: Omit<Intervention, 'durationSeconds'> & { steps: InterventionStep[] },
): Intervention => ({
  ...spec,
  durationSeconds: spec.steps.reduce((sum, step) => sum + step.seconds, 0),
});

export const INTERVENTIONS: Intervention[] = [
  build({
    id: 'stabilize-90',
    name: '90-second stabilization',
    persona: 'stabilizer',
    pressure: 'sudden-shock',
    premise:
      'Under a sudden hit the mind treats every consequence as due tonight. Naming what is actually due tonight shrinks the pile back to its real size.',
    steps: [
      {
        instruction: 'Say what happened, in one sentence.',
        detail: 'Out loud or in your head. Just the fact, no forecast attached to it.',
        seconds: 20,
      },
      {
        instruction: 'Drop your shoulders. Breathe out slowly, longer than you breathed in.',
        detail: 'Three times. The long exhale is the part that does the work.',
        seconds: 25,
      },
      {
        instruction: 'Name one thing that genuinely needs you today.',
        detail: 'Today. Not this month. Most of the time the honest answer is small.',
        seconds: 25,
      },
      {
        instruction: 'Name one thing your mind says is urgent that can wait 24 hours.',
        detail: 'Set it down there. It will still be waiting tomorrow, and so will you.',
        seconds: 20,
      },
    ],
    checkpointQuestion: 'Is your breathing any different than it was 90 seconds ago?',
  }),

  build({
    id: 'sort-two-column',
    name: 'The two-column sort',
    persona: 'clarifier',
    pressure: 'overwhelm',
    premise:
      'Overwhelm is a sorting failure, not a volume failure. Once things are in two columns, the pile stops behaving like one enormous task.',
    steps: [
      {
        instruction: 'Write down everything currently on you. Fast, messy, no order.',
        detail: 'Two minutes of brain-dump beats an hour of organising in your head.',
        seconds: 60,
      },
      {
        instruction: 'Mark anything with a real external deadline in the next 48 hours.',
        detail: 'A real one. Someone else is waiting and there is a consequence.',
        seconds: 40,
      },
      {
        instruction: 'Everything unmarked goes in a second column called "not this week".',
        detail: 'It is not being abandoned. It is being scheduled out of today.',
        seconds: 30,
      },
      {
        instruction: 'From the marked column, pick the single item you will do first.',
        detail: 'One. The rest of that column is now second, third, fourth.',
        seconds: 30,
      },
    ],
    checkpointQuestion: 'Can you see what actually matters today more clearly than before?',
  }),

  build({
    id: 'name-it',
    name: 'Naming what this actually is',
    persona: 'companion',
    pressure: 'isolation',
    premise:
      'Unnamed feeling stays diffuse and therefore endless. Giving it an accurate name makes it a thing with edges — and edges can be carried.',
    steps: [
      {
        instruction: 'Describe the feeling without using the word "fine" or "stressed".',
        detail: 'Reach for the specific word. Abandoned. Overlooked. Tired of explaining.',
        seconds: 45,
      },
      {
        instruction: 'Say where you notice it physically.',
        detail: 'Chest, throat, jaw, stomach. Feeling and sensation are usually the same event.',
        seconds: 30,
      },
      {
        instruction: 'Finish this sentence: "Anyone in this situation would feel…"',
        detail: 'This is not self-pity. It is accuracy, applied to yourself.',
        seconds: 30,
      },
      {
        instruction: 'Name one person who would not be surprised to hear this from you.',
        detail: 'You do not have to message them. Just establish that they exist.',
        seconds: 35,
      },
    ],
    checkpointQuestion: 'Does it feel any less like something you are carrying alone?',
  }),

  build({
    id: 'capability-reset',
    name: '24-hour capability reset',
    persona: 'rebuilder',
    pressure: 'identity-disruption',
    premise:
      'After a rupture, confidence returns last. Capability returns first — but only if you give yourself something small enough to actually complete.',
    steps: [
      {
        instruction: 'Name one thing you were reliably good at before this happened.',
        detail: 'The skill did not leave with the situation.',
        seconds: 35,
      },
      {
        instruction: 'Pick one task in the next 24 hours that uses a fraction of it.',
        detail: 'Small enough that failing is not really available to you.',
        seconds: 40,
      },
      {
        instruction: 'Say when you will do it. An actual time.',
        detail: '"Tomorrow" is not a time. "After coffee, before I open my email" is.',
        seconds: 30,
      },
      {
        instruction: 'Decide what you will tell yourself once it is done.',
        detail: 'Have the sentence ready. Otherwise the win gets filed as "that was nothing".',
        seconds: 35,
      },
    ],
    checkpointQuestion: 'Do you have one concrete thing you can do in the next day?',
  }),

  build({
    id: 'three-path-map',
    name: '3-path decision map',
    persona: 'navigator',
    pressure: 'decision-paralysis',
    premise:
      'A decision loops when its costs have never been stated. Saying the price of each path out loud usually ends the loop within minutes.',
    steps: [
      {
        instruction: 'Write the decision as a question with an actual deadline.',
        detail: '"Do I take the offer, by Friday" is decidable. "What do I do with my life" is not.',
        seconds: 40,
      },
      {
        instruction: 'Name three paths, including the one where you change nothing.',
        detail: 'Doing nothing is a real option with a real cost. Put it on the board.',
        seconds: 50,
      },
      {
        instruction: 'For each path, write what it costs you — not what it gains.',
        detail: 'Costs are where the honest information is.',
        seconds: 50,
      },
      {
        instruction: 'Name the one piece of information that would settle it.',
        detail: 'Then decide whether you can actually get it, or whether you are waiting for certainty that will not arrive.',
        seconds: 40,
      },
    ],
    checkpointQuestion: 'Do you know what your next step is, even if the decision is not final?',
  }),

  build({
    id: 'downshift-3',
    name: '3-minute downshift',
    persona: 'regulator',
    pressure: 'burnout',
    premise:
      'A long exhale is one of the few levers you have on your own arousal from the outside. This is not relaxation for its own sake — it is making thought available again.',
    steps: [
      {
        instruction: 'Sit back. Let your jaw and shoulders go slack.',
        detail: 'Most people hold both without noticing all day.',
        seconds: 30,
      },
      {
        instruction: 'Breathe in for four. Out for eight. Keep going.',
        detail: 'The exact count matters less than the exhale being the longer half.',
        seconds: 75,
      },
      {
        instruction: 'Keep the rhythm and let your gaze go soft and wide.',
        detail: 'Stop focusing on any one point. Take in the whole room at once.',
        seconds: 45,
      },
      {
        instruction: 'Name one thing you are not going to do for the rest of today.',
        detail: 'Down-shifting is not just physical. Something has to actually come off the load.',
        seconds: 30,
      },
    ],
    checkpointQuestion: 'Is your body any less tense than it was three minutes ago?',
  }),

  build({
    id: 'starter-blueprint',
    name: '7-day starter blueprint',
    persona: 'architect',
    pressure: 'new-beginning',
    premise:
      'A new situation strips out every automatic routine at once. You do not need a system for the year — you need three fixed points for the week.',
    steps: [
      {
        instruction: 'Pick your anchor: one thing that happens at the same time every day.',
        detail: 'Wake time, a meal, a walk. Everything else hangs off this.',
        seconds: 40,
      },
      {
        instruction: 'Name the one thing that must happen daily for this week to count.',
        detail: 'One. Not five. The point is that it is achievable on your worst day.',
        seconds: 40,
      },
      {
        instruction: 'Decide what happens when you miss a day.',
        detail: 'Decide it now, calmly, rather than at 11pm feeling like a failure.',
        seconds: 35,
      },
      {
        instruction: 'Pick the day you will look back and adjust the plan.',
        detail: 'A plan with no review date is a wish.',
        seconds: 30,
      },
    ],
    checkpointQuestion: 'Do you have a plan you could actually follow this week?',
  }),

  build({
    id: 'thread-extraction',
    name: 'Thought-thread extraction',
    persona: 'unraveler',
    pressure: 'racing-thoughts',
    premise:
      'A racing mind is rarely one thought at speed. It is several unfinished ones braided together, each re-entering because none was ever set down.',
    steps: [
      {
        instruction: 'Catch the loudest thought and write it down as a single sentence.',
        detail: 'Just that one. The others will wait, loudly, and that is fine.',
        seconds: 40,
      },
      {
        instruction: 'Ask it: is this a problem, a fear, or a decision?',
        detail: 'Those three need completely different handling. Most loops are miscategorised fears.',
        seconds: 40,
      },
      {
        instruction: 'Write the next thread underneath. Repeat until the page stops filling.',
        detail: 'Usually three or four. It is almost never as many as it felt like.',
        seconds: 55,
      },
      {
        instruction: 'Circle the only one that anything can be done about tonight.',
        detail: 'Often none of them. Discovering that is itself the relief.',
        seconds: 35,
      },
    ],
    checkpointQuestion: 'Is your mind any quieter than it was a few minutes ago?',
  }),

  build({
    id: 'micro-proof',
    name: 'Confidence micro-proof',
    persona: 'encourager',
    pressure: 'self-doubt',
    premise:
      'Doubt runs on missing evidence. Your brain files past capability under "that was different" and stops counting it. This puts one item back on the ledger.',
    steps: [
      {
        instruction: 'Name something you can do now that you once could not.',
        detail: 'Anything. Driving, a language, a job you were unqualified for on day one.',
        seconds: 40,
      },
      {
        instruction: 'Remember how certain you were, beforehand, that you would not manage it.',
        detail: 'That certainty felt exactly as true then as this one does now.',
        seconds: 35,
      },
      {
        instruction: 'Name the specific thing you did that closed the gap.',
        detail: 'Not luck. The repeated, boring thing. That is the transferable part.',
        seconds: 40,
      },
      {
        instruction: 'Apply that same move to the thing you are doubting today.',
        detail: 'One sentence. What is this week’s version of the boring repeated thing?',
        seconds: 35,
      },
    ],
    checkpointQuestion: 'Does the thing you are doubting feel any more within reach?',
  }),

  build({
    id: 'daily-checkin',
    name: 'Daily 1-minute check-in',
    persona: 'continuity-guide',
    pressure: 'continuation',
    premise:
      'Momentum breaks when the original pressure fades and nothing replaces it. One honest minute a day is enough to keep the thread attached.',
    steps: [
      {
        instruction: 'Rate today out of ten. No explanation required.',
        detail: 'The number is for tracking, not for judging.',
        seconds: 15,
      },
      {
        instruction: 'Name one thing that went better than expected.',
        detail: 'Small counts. Small is the whole method.',
        seconds: 20,
      },
      {
        instruction: 'Name the one thing worth protecting tomorrow.',
        detail: 'Sleep, a boundary, one task, one conversation you keep postponing.',
        seconds: 25,
      },
    ],
    checkpointQuestion: 'Is it clear what tomorrow needs to look like?',
  }),
];

const BY_PRESSURE = new Map<PressureId, Intervention[]>();
INTERVENTIONS.forEach((i) => {
  BY_PRESSURE.set(i.pressure, [...(BY_PRESSURE.get(i.pressure) ?? []), i]);
});

export const interventionsFor = (pressure: PressureId): Intervention[] =>
  BY_PRESSURE.get(pressure) ?? [];

export const interventionForPersona = (persona: PersonaId): Intervention | undefined =>
  INTERVENTIONS.find((i) => i.persona === persona);

/**
 * Picks the next intervention for a pressure, skipping anything already tried
 * this session. Falls back to the supporting personas' interventions, because
 * "that did not help" should lead somewhere other than a repeat.
 */
export function nextIntervention(
  pressure: PressureId,
  supportPersonas: PersonaId[],
  tried: string[],
): Intervention | null {
  const primary = interventionsFor(pressure).find((i) => !tried.includes(i.id));
  if (primary) return primary;

  for (const persona of supportPersonas) {
    const alt = interventionForPersona(persona);
    if (alt && !tried.includes(alt.id)) return alt;
  }
  return null;
}
