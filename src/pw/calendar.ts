import type { Channel, ContentFormat, PersonaId } from './types';

/**
 * The publishing rhythm.
 *
 * One brand account per channel per persona, publishing on a stated cadence.
 * Everything here is first-party, disclosed, and attributable — see
 * docs/performance-wellness/distribution-policy.md for what is deliberately
 * absent from this file.
 */

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' | 'Daily';

export interface CalendarSlot {
  persona: PersonaId;
  day: Weekday;
  channel: Channel;
  format: ContentFormat;
  topic: string;
}

export const CONTENT_CALENDAR: CalendarSlot[] = [
  // The Stabilizer
  { persona: 'stabilizer', day: 'Mon', channel: 'youtube', format: 'long-form', topic: 'What shock does to decision-making' },
  { persona: 'stabilizer', day: 'Wed', channel: 'reels', format: 'short-form', topic: 'The 90-second reset' },
  { persona: 'stabilizer', day: 'Sun', channel: 'instagram', format: 'carousel', topic: 'Today vs. can-wait-24-hours' },

  // The Clarifier
  { persona: 'clarifier', day: 'Tue', channel: 'linkedin', format: 'article', topic: 'Overwhelm is a sorting problem' },
  { persona: 'clarifier', day: 'Thu', channel: 'tiktok', format: 'short-form', topic: 'The two-column sort in 40 seconds' },
  { persona: 'clarifier', day: 'Sat', channel: 'x', format: 'thread', topic: 'Why everything feels equally urgent' },

  // The Companion
  { persona: 'companion', day: 'Mon', channel: 'instagram', format: 'carousel', topic: 'Naming what this actually is' },
  { persona: 'companion', day: 'Wed', channel: 'youtube', format: 'long-form', topic: 'The second weight nobody talks about' },
  { persona: 'companion', day: 'Fri', channel: 'reddit', format: 'long-form', topic: 'Answering one question properly' },

  // The Rebuilder
  { persona: 'rebuilder', day: 'Tue', channel: 'linkedin', format: 'article', topic: 'Capability returns before confidence' },
  { persona: 'rebuilder', day: 'Thu', channel: 'instagram', format: 'carousel', topic: 'The 24-hour capability reset' },
  { persona: 'rebuilder', day: 'Sat', channel: 'youtube', format: 'long-form', topic: 'Rebuilding after a role ends' },

  // The Navigator
  { persona: 'navigator', day: 'Mon', channel: 'x', format: 'thread', topic: 'The 3-path decision map' },
  { persona: 'navigator', day: 'Wed', channel: 'youtube', format: 'long-form', topic: 'Why decisions loop' },
  { persona: 'navigator', day: 'Fri', channel: 'linkedin', format: 'article', topic: 'Costs, not gains' },

  // The Regulator
  { persona: 'regulator', day: 'Tue', channel: 'tiktok', format: 'short-form', topic: 'The 3-minute downshift' },
  { persona: 'regulator', day: 'Thu', channel: 'instagram', format: 'carousel', topic: 'What sustained load actually does' },
  { persona: 'regulator', day: 'Sat', channel: 'youtube', format: 'long-form', topic: 'Burnout is not a discipline problem' },

  // The Architect
  { persona: 'architect', day: 'Mon', channel: 'linkedin', format: 'article', topic: 'The 7-day starter blueprint' },
  { persona: 'architect', day: 'Wed', channel: 'instagram', format: 'carousel', topic: 'Three fixed points beat a perfect system' },
  { persona: 'architect', day: 'Fri', channel: 'youtube', format: 'long-form', topic: 'Your first week somewhere new' },

  // The Unraveler
  { persona: 'unraveler', day: 'Tue', channel: 'tiktok', format: 'short-form', topic: 'Pull one thread out' },
  { persona: 'unraveler', day: 'Thu', channel: 'reddit', format: 'long-form', topic: 'Problem, fear, or decision?' },
  { persona: 'unraveler', day: 'Sat', channel: 'instagram', format: 'carousel', topic: 'It is never as many thoughts as it feels like' },

  // The Encourager
  { persona: 'encourager', day: 'Mon', channel: 'instagram', format: 'carousel', topic: 'Evidence, not a pep talk' },
  { persona: 'encourager', day: 'Wed', channel: 'reels', format: 'short-form', topic: 'One confidence micro-proof' },
  { persona: 'encourager', day: 'Fri', channel: 'x', format: 'thread', topic: 'Where doubt gets its material' },

  // The Continuity Guide
  { persona: 'continuity-guide', day: 'Daily', channel: 'in-product', format: 'check-in', topic: 'One-minute check-in' },
  { persona: 'continuity-guide', day: 'Fri', channel: 'newsletter', format: 'check-in', topic: 'Weekly progress reflection' },
  { persona: 'continuity-guide', day: 'Sun', channel: 'instagram', format: 'carousel', topic: 'What was worth keeping this week' },
];

export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Daily'];

export const slotsForDay = (day: Weekday): CalendarSlot[] =>
  CONTENT_CALENDAR.filter((slot) => slot.day === day);
