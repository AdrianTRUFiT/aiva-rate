/**
 * SoulHostⓈ — the threshold voice, and the only identity a person ever sees.
 *
 * The ten guides are real and they do real work: they select the copy, the
 * exercise, and the shape of the week, and they carry the attribution that
 * tells us which front door earned a transaction. But they are *capabilities*,
 * not a cast. Parading ten named personas at someone in distress asks them to
 * form ten relationships at the moment they have capacity for none.
 *
 * So SoulHost holds continuity at the human-facing edge and the guides work
 * behind it. SoulHost is deliberately restrained: it asks the question, it
 * reflects back what it heard, and then it gets out of the way. It is not the
 * coach and it must never become the product.
 */

export const SOULHOST = {
  name: 'SoulHost',

  threshold: {
    question: 'What is putting the most pressure on you right now?',
    invitation:
      "You don't need to explain everything perfectly, and you don't need to start at the beginning. Start with one thing.",
    placeholder: 'In your own words…',
  },

  /** Said once the person has been heard, before anything is suggested. */
  heard: 'I hear you. You do not have to solve all of that today.',

  /** Framing for the exercise hand-off — names no guide. */
  handoff: (interventionName: string, minutes: number) =>
    `Let's identify the next thing that matters. ${interventionName} takes about ${minutes} minute${
      minutes === 1 ? '' : 's'
    }, and you can stop at any point.`,

  /** How the daily message opens, once someone is in the week. */
  daily: (day: number) => `Day ${day}. One minute, then the rest of your day is yours.`,

  /** Standing disclosure. Present wherever SoulHost speaks. */
  disclosure:
    'You are talking to an AI guide, not a person, and not a therapist. Nothing here is medical or psychological treatment.',
} as const;
