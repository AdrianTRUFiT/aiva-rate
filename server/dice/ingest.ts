import type { RawSignal } from './types';

/**
 * Operator-assisted ingest.
 *
 * An operator browsing Reddit as a human pastes what they found. DICE turns it
 * into the same `RawSignal` an automated source would produce and runs it down
 * the same pipeline.
 *
 * What this deliberately does NOT do is fetch the URL server-side. Pulling post
 * bodies out of Reddit without going through the Data API is the same category
 * of move as rotating accounts to beat a rate limit, and it would put the ten
 * accounts at risk rather than protect them. Everything here comes from what the
 * operator could already see in their own browser.
 */

/** How much evidence a signal carries. Scoring degrades honestly with it. */
export type CaptureLevel =
  /** URL only — subreddit, post id and the title slug. */
  | 'url-only'
  /** The operator also pasted the post body. */
  | 'with-body';

export interface ParsedEntry {
  url: string;
  subreddit: string;
  postId: string;
  /** Recovered from the URL slug, or the first line the operator pasted. */
  title: string;
  body: string;
  author: string;
  /** Null when the operator did not say how old the post is. */
  createdAt: string | null;
  capture: CaptureLevel;
}

export interface ParseFailure {
  line: string;
  reason: string;
}

export interface ParseResult {
  entries: ParsedEntry[];
  failures: ParseFailure[];
}

const REDDIT_HOSTS = /^(www\.|old\.|new\.|np\.|i\.|m\.)?reddit\.com$/i;

/** `1abc234` in /r/jobs/comments/1abc234/slug/ */
const PERMALINK = /^\/r\/([A-Za-z0-9_]+)\/comments\/([A-Za-z0-9]+)(?:\/([^/?#]*))?/;

const isUrlish = (line: string) => /^https?:\/\//i.test(line.trim());

/** "got_laid_off_this_morning" -> "Got laid off this morning" */
function titleFromSlug(slug: string): string {
  const words = decodeURIComponent(slug).replace(/[_-]+/g, ' ').trim();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Parses one Reddit post URL. Returns null with a reason when the URL cannot
 * yield a subreddit and post id, which is what everything downstream keys on.
 */
export function parseRedditUrl(raw: string): { ok: true; value: Omit<ParsedEntry, 'body' | 'author' | 'createdAt' | 'capture'> } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'Not a URL.' };
  }

  if (/^redd\.it$/i.test(url.hostname)) {
    return {
      ok: false,
      reason: 'Short redd.it links do not carry the subreddit. Open the post and paste the full URL.',
    };
  }

  if (!REDDIT_HOSTS.test(url.hostname)) {
    return { ok: false, reason: `Not a Reddit post URL (host: ${url.hostname}).` };
  }

  const match = url.pathname.match(PERMALINK);
  if (!match) {
    return {
      ok: false,
      reason: 'Not a post permalink. It should look like /r/<subreddit>/comments/<id>/<slug>.',
    };
  }

  const [, subreddit, postId, slug] = match;
  return {
    ok: true,
    value: {
      // Canonical, query-string stripped: tracking params must not defeat dedupe.
      url: `https://www.reddit.com/r/${subreddit}/comments/${postId}/`,
      subreddit: subreddit.toLowerCase(),
      postId,
      title: slug ? titleFromSlug(slug) : '',
    },
  };
}

/** `posted: 3h` / `age: 2 days` — optional, and only the operator can know it. */
function parseAge(line: string, now: Date): string | null {
  const match = line.match(/^(?:posted|age)\s*:\s*(\d+)\s*(m|min|mins|h|hr|hrs|hour|hours|d|day|days)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms = unit.startsWith('m') && unit !== 'mo' ? value * 60_000
    : unit.startsWith('h') ? value * 3_600_000
    : value * 86_400_000;

  return new Date(now.getTime() - ms).toISOString();
}

/**
 * Parses a pasted block.
 *
 * A line that is a URL starts a new entry. Everything after it until the next
 * URL is that post's body. So a bare list of URLs and a list of URL-then-text
 * blocks both parse correctly, which matters because an operator will do both.
 *
 * Two optional conventions inside a block:
 *   u/somebody      -> the author handle
 *   posted: 3h      -> how old the post is
 */
export function parsePaste(text: string, now: Date): ParseResult {
  const entries: ParsedEntry[] = [];
  const failures: ParseFailure[] = [];

  let current: ParsedEntry | null = null;
  const bodyLines: string[] = [];

  const flush = () => {
    if (!current) return;
    const body = bodyLines.join('\n').trim();
    entries.push({
      ...current,
      body,
      capture: body ? 'with-body' : 'url-only',
      // A pasted first line is a better title than a URL slug.
      title: current.title || body.split('\n')[0]?.slice(0, 140) || '(untitled)',
    });
    current = null;
    bodyLines.length = 0;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (isUrlish(line)) {
      flush();
      const parsed = parseRedditUrl(line);
      if (!parsed.ok) {
        failures.push({ line, reason: parsed.reason });
        continue;
      }
      current = { ...parsed.value, body: '', author: '', createdAt: null, capture: 'url-only' };
      continue;
    }

    if (!current) {
      if (line) failures.push({ line, reason: 'Text before any URL — start each post with its link.' });
      continue;
    }

    const author = line.match(/^u\/([A-Za-z0-9_-]{2,20})\b/);
    if (author) {
      current.author = author[1];
      continue;
    }

    const age = parseAge(line, now);
    if (age) {
      current.createdAt = age;
      continue;
    }

    bodyLines.push(rawLine);
  }

  flush();
  return { entries, failures };
}

/**
 * Converts a parsed entry into the same shape an automated source returns, so
 * everything downstream — dedupe, safety, policy, scoring, collision, queue —
 * cannot tell the two apart.
 */
export function toRawSignal(entry: ParsedEntry, deskId: string, now: Date): RawSignal {
  return {
    sourceId: `manual:${deskId}:${entry.subreddit}:${entry.postId}`,
    subreddit: entry.subreddit,
    postId: entry.postId,
    author: entry.author || 'unknown',
    title: entry.title,
    body: entry.body,
    permalink: entry.url,
    // When the operator did not say, discovery time stands in and the signal is
    // flagged so the score can decline to claim the post is fresh.
    createdAt: entry.createdAt ?? now.toISOString(),
  };
}
