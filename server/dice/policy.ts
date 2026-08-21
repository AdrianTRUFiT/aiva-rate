import { screen } from '../../src/pw/safety';
import type { ActionGate, ActionPermissions, Collision, Desk, RawSignal } from './types';

/**
 * Subreddit policy — the floor DICE will not go below.
 *
 * Two rules, both default-deny:
 *
 *  1. Blocked subreddits are never searched, never surfaced, never contacted.
 *     These are acute crisis peer-support communities. Outreach there is
 *     against their rules and against the point of them. A desk's `exclusions`
 *     list is operator-editable; this is not.
 *
 *  2. Everywhere else, replying requires the subreddit to be explicitly marked
 *     as permitting it, and messaging requires the same. An unlisted subreddit
 *     permits neither. Adding a subreddit to the allowlist should mean somebody
 *     read its current rules that week — the `verified` field records when.
 *
 * This list is a starting floor written from general knowledge of these
 * communities. It is not a substitute for reading each subreddit's current
 * rules, and it needs review by someone who actually participates in them.
 */

export interface SubredditRule {
  name: string;
  blocked?: boolean;
  reason?: string;
  allowReply?: boolean;
  allowMessage?: boolean;
  /** When someone last checked this subreddit's posted rules. */
  verified?: string;
  note?: string;
}

/**
 * Never searched, never surfaced, never contacted — regardless of desk
 * configuration, operator action, or scoring.
 */
export const BLOCKED_SUBREDDITS: SubredditRule[] = [
  { name: 'suicidewatch', blocked: true, reason: 'Crisis peer support. Solicitation and unsolicited DMs are a serious rule violation.' },
  { name: 'sanctionedsuicide', blocked: true, reason: 'Pro-suicide community. No contact under any circumstances.' },
  { name: 'selfharm', blocked: true, reason: 'Acute self-harm support. Outreach is inappropriate.' },
  { name: 'stopselfharm', blocked: true, reason: 'Acute self-harm support. Outreach is inappropriate.' },
  { name: 'depression', blocked: true, reason: 'Crisis-adjacent peer support with an explicit no-promotion rule.' },
  { name: 'depression_help', blocked: true, reason: 'Crisis-adjacent peer support.' },
  { name: 'swresources', blocked: true, reason: 'Crisis resource community.' },
  { name: 'mmfb', blocked: true, reason: 'Crisis-adjacent peer support (MakeMeFeelBetter).' },
  { name: 'suicidebereavement', blocked: true, reason: 'Bereavement support. Outreach is inappropriate.' },
  { name: 'ptsd', blocked: true, reason: 'Clinical trauma community. Out of scope for a wellness product.' },
  { name: 'bipolarreddit', blocked: true, reason: 'Clinical community. Out of scope for a wellness product.' },
  { name: 'psychoticreddit', blocked: true, reason: 'Clinical community. Out of scope for a wellness product.' },
  { name: 'eatingdisorders', blocked: true, reason: 'Clinical community. Out of scope for a wellness product.' },
  { name: 'addiction', blocked: true, reason: 'Clinical community. Out of scope for a wellness product.' },
];

/**
 * Subreddits where a public reply is plausibly within the rules. Every entry
 * needs its posted rules re-read before that desk is switched on — the date is
 * a claim about when someone last did that, and an empty one means nobody has.
 */
export const ALLOWED_SUBREDDITS: SubredditRule[] = [
  { name: 'jobs', allowReply: true, note: 'Check self-promotion rules before enabling.' },
  { name: 'careerguidance', allowReply: true, note: 'Check self-promotion rules before enabling.' },
  { name: 'layoffs', allowReply: true, note: 'Check self-promotion rules before enabling.' },
  { name: 'productivity', allowReply: true },
  { name: 'getdisciplined', allowReply: true },
  { name: 'getmotivated', allowReply: true },
  { name: 'college', allowReply: true },
  { name: 'gradschool', allowReply: true },
  { name: 'studytips', allowReply: true },
  { name: 'decidingtobebetter', allowReply: true },
  { name: 'selfimprovement', allowReply: true },
  { name: 'antiwork', allowReply: true },
  { name: 'overemployed', allowReply: true },
  { name: 'workreform', allowReply: true },
];

const RULES = new Map<string, SubredditRule>(
  [...BLOCKED_SUBREDDITS, ...ALLOWED_SUBREDDITS].map((r) => [r.name.toLowerCase(), r]),
);

export const normaliseSubreddit = (name: string): string =>
  name.replace(/^\/?r\//i, '').trim().toLowerCase();

export const ruleFor = (subreddit: string): SubredditRule | null =>
  RULES.get(normaliseSubreddit(subreddit)) ?? null;

export function isBlocked(subreddit: string): SubredditRule | null {
  const rule = ruleFor(subreddit);
  return rule?.blocked ? rule : null;
}

/**
 * Filters a desk's configured subreddits down to the ones it may actually
 * search. Applied before discovery, so a blocked subreddit is never queried in
 * the first place — not queried and then filtered out of the results.
 */
export function searchableSubreddits(desk: Desk): { allowed: string[]; refused: SubredditRule[] } {
  const allowed: string[] = [];
  const refused: SubredditRule[] = [];

  for (const raw of desk.lens.subreddits) {
    const name = normaliseSubreddit(raw);
    const blocked = isBlocked(name);
    if (blocked) refused.push(blocked);
    else allowed.push(name);
  }
  return { allowed, refused };
}

export type ScreenOutcome =
  | { ok: true }
  | { ok: false; state: 'blocked' | 'do-not-contact'; reason: string };

/**
 * Screens one raw signal before it can become an opportunity.
 *
 * Note the inversion from the inbound product: there, a crisis signal is the
 * most urgent thing in the system. Here it means *do not contact*. Somebody in
 * crisis posting publicly is not a lead, and the correct handling is to drop
 * them from the queue entirely rather than rank them first.
 */
export function screenSignal(raw: RawSignal): ScreenOutcome {
  const blocked = isBlocked(raw.subreddit);
  if (blocked) {
    return { ok: false, state: 'blocked', reason: blocked.reason ?? 'Subreddit is off-limits for outreach.' };
  }

  const safety = screen(`${raw.title}\n${raw.body}`);
  if (safety.level === 'route') {
    return {
      ok: false,
      state: 'do-not-contact',
      reason: `Crisis language detected (${safety.categories.join(', ')}). This person is not a prospect.`,
    };
  }

  return { ok: true };
}

const DENIED = (reason: string) => ({ allowed: false, reason });

/**
 * Resolves what a desk may actually do with a signal.
 *
 * Default deny. Every gate below has to say yes; the first no wins and its
 * reason is what the operator sees on the card.
 */
export function resolveActions(
  desk: Desk,
  subreddit: string,
  screened: ScreenOutcome,
  collision: Collision | null,
): ActionPermissions {
  if (!screened.ok) {
    const gate = DENIED(screened.reason);
    return { reply: gate, message: gate };
  }

  if (collision) {
    const gate = DENIED(
      `Already worked by ${collision.deskId} (${collision.on === 'author' ? 'same person' : 'same thread'}). Resolve before another desk acts.`,
    );
    return { reply: gate, message: gate };
  }

  if (desk.auth !== 'connected') {
    const gate = DENIED(`Desk account is ${desk.auth}. Reconnect before acting.`);
    return { reply: gate, message: gate };
  }

  const rule = ruleFor(subreddit);

  const reply: ActionGate = !desk.grants.comment
    ? DENIED('This account has no comment grant.')
    : !rule?.allowReply
      ? DENIED(
          rule
            ? `r/${normaliseSubreddit(subreddit)} is not marked as permitting replies.`
            : `r/${normaliseSubreddit(subreddit)} has no reviewed rule entry. Unlisted subreddits deny by default.`,
        )
      : { allowed: true, reason: `r/${normaliseSubreddit(subreddit)} permits public replies.` };

  // Messaging is denied everywhere by default and no subreddit currently
  // enables it. Unsolicited DMs to people posting about a bad week is the
  // fastest route to ten simultaneous bans, and is what the distribution
  // policy already excluded.
  const message: ActionGate = !desk.grants.message
    ? DENIED('This account has no message grant.')
    : !rule?.allowMessage
      ? DENIED('Direct messaging is not enabled for any subreddit. This is a policy decision, not a missing feature.')
      : { allowed: true, reason: `r/${normaliseSubreddit(subreddit)} permits messaging.` };

  return { reply, message };
}
