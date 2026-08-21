import { SOULHOST } from '../src/pw/soulhost';
import { RESET_OFFER } from '../src/pw/continuity';
import type { ResetDay } from '../src/pw/continuity';
import type { OutboundMessage } from './mail/types';

/**
 * The messages that leave the browser.
 *
 * Written in SoulHost's voice, not a guide's — the person has one relationship
 * here, and it stays the same one whichever capability is doing the work that
 * day. Plain text on purpose: it renders everywhere, it cannot carry tracking
 * pixels, and it reads like something a person would actually send.
 */

const line = (s: string) => s.trim();

export function dailyMessage(
  to: string,
  day: ResetDay,
  resumeUrl: string,
  isFinalDay: boolean,
): OutboundMessage {
  const steps = day.intervention.steps
    .map((s, i) => `  ${i + 1}. ${s.instruction}`)
    .join('\n');

  const body = [
    line(SOULHOST.daily(day.day)),
    '',
    line(day.intervention.premise),
    '',
    `${day.intervention.name}:`,
    steps,
    '',
    `Then, if you want to log it: ${day.checkIn}`,
    '',
    `Open today: ${resumeUrl}`,
    '',
    isFinalDay
      ? line(
          "That's the week. Nothing renews and there is nothing to cancel — this was seven days and it ends here. If it was useful, you know where to find it.",
        )
      : line('Tomorrow opens 24 hours from now. Missing a day is not a relapse.'),
    '',
    '—',
    line(SOULHOST.disclosure),
    'If you are in crisis, contact your local emergency number, or find a helpline at findahelpline.com',
  ].join('\n');

  return {
    to,
    subject: isFinalDay ? `Day ${day.day} — the last one` : `Day ${day.day} — ${day.intervention.name}`,
    text: body,
    // Idempotency is per enrolment-day, so a repeated sweep cannot double-send.
    key: `day-${day.day}`,
  };
}

export function welcomeMessage(to: string, resumeUrl: string): OutboundMessage {
  const body = [
    line("You're in. Here is what happens next."),
    '',
    ...RESET_OFFER.commitments.map((c) => `· ${c}`),
    '',
    line(
      'One link is all you need — no password, no account. Keep this message and you can pick the week back up from any device.',
    ),
    '',
    `Your week: ${resumeUrl}`,
    '',
    '—',
    line(SOULHOST.disclosure),
  ].join('\n');

  return { to, subject: `${RESET_OFFER.name} — your link`, text: body, key: 'welcome' };
}

/**
 * Sent when a check-in trips the safety screen. Delivery is paused at the same
 * moment; this message is the only thing that goes out afterwards.
 */
export function safetyPauseMessage(to: string, resumeUrl: string): OutboundMessage {
  const body = [
    line('I have paused the daily messages.'),
    '',
    line(
      "What you wrote needs a person, not an automated guide. Nothing further will be sent and nothing is being asked of you.",
    ),
    '',
    'If you want to talk to someone now:',
    '  · Emergency services — 911 (US) · 999 (UK) · 112 (EU)',
    '  · 988 Suicide & Crisis Lifeline — call or text 988 (US)',
    '  · Crisis Text Line — text HOME to 741741 (US/CA)',
    '  · findahelpline.com — free helplines in over 130 countries',
    '',
    `If you want the week back later, it is here: ${resumeUrl}`,
  ].join('\n');

  return { to, subject: 'Pausing your daily messages', text: body, key: 'safety-pause' };
}
