/**
 * dice:verify — checks one desk's Reddit credentials without ever printing them.
 *
 *   npm run dice:verify -- --desk stabilizer
 *
 * Does the refresh-token handshake, confirms which account the token belongs
 * to, makes one real search call, and reports the rate limit Reddit actually
 * assigned. Everything it prints is safe to paste into a chat or a ticket:
 * no client id, no secret, no token.
 *
 * This exists so credentials can be verified by whoever holds them, rather than
 * being handed to anybody else to test with.
 */
import 'dotenv/config';
import { DESK_IDS, isDeskId } from '../server/dice/accounts';
import { searchableSubreddits } from '../server/dice/policy';
import { buildDesk } from '../server/dice/accounts';

const OAUTH = 'https://www.reddit.com/api/v1/access_token';
const API = 'https://oauth.reddit.com';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
};

const env = (desk: string, suffix: string) =>
  process.env[`DICE_REDDIT_${desk.toUpperCase().replace(/-/g, '_')}_${suffix}`]?.trim() ?? '';

const ok = (m: string) => console.log(`  ✓ ${m}`);
const no = (m: string) => console.log(`  ✗ ${m}`);

async function main(): Promise<number> {
  const deskId = arg('desk');

  if (!deskId || !isDeskId(deskId)) {
    console.error(`Usage: npm run dice:verify -- --desk <id>\nDesks: ${DESK_IDS.join(', ')}`);
    return 2;
  }

  console.log(`\nVerifying desk: ${deskId}\n`);

  const clientId = env(deskId, 'CLIENT_ID');
  const clientSecret = env(deskId, 'CLIENT_SECRET');
  const refreshToken = env(deskId, 'REFRESH_TOKEN');
  const userAgent = process.env.DICE_REDDIT_USER_AGENT?.trim() ?? '';

  /* --- configuration ---------------------------------------------------- */
  const missing: string[] = [];
  if (!clientId) missing.push('CLIENT_ID');
  if (!clientSecret) missing.push('CLIENT_SECRET');
  if (!refreshToken) missing.push('REFRESH_TOKEN');
  if (!userAgent) missing.push('DICE_REDDIT_USER_AGENT');

  if (missing.length) {
    console.log('  Not configured. Missing:');
    for (const key of missing) {
      no(key === 'DICE_REDDIT_USER_AGENT' ? key : `DICE_REDDIT_${deskId.toUpperCase().replace(/-/g, '_')}_${key}`);
    }
    console.log(`
  Reddit blocks generic user agents, so DICE_REDDIT_USER_AGENT is required:
    web:performance-wellness-dice:v1 (by /u/yourhandle)

  Note: DICE runs on operator-assisted ingest without any of this. These are
  only needed for the automated Reddit adapter, which also requires commercial
  API access — see docs/performance-wellness/dice.md.
`);
    return 1;
  }
  ok('all four values are present');

  /* --- token handshake -------------------------------------------------- */
  let token: string;
  try {
    const res = await fetch(OAUTH, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });

    if (!res.ok) {
      no(`token exchange failed (HTTP ${res.status})`);
      console.log(`    ${(await res.text()).slice(0, 200)}`);
      console.log('\n    401 usually means the client id/secret pair is wrong or the app type is not "web app".');
      return 1;
    }

    const body = (await res.json()) as { access_token?: string; scope?: string };
    if (!body.access_token) {
      no('token exchange returned no access_token');
      return 1;
    }
    token = body.access_token;
    ok(`token exchange succeeded — scopes: ${body.scope ?? 'unreported'}`);

    if (body.scope && !body.scope.split(/[\s,]+/).includes('read')) {
      no('the token has no "read" scope — discovery will not work');
    }
  } catch (err) {
    no(`could not reach Reddit: ${(err as Error).message}`);
    return 1;
  }

  const authed = { Authorization: `Bearer ${token}`, 'User-Agent': userAgent };

  /* --- identity --------------------------------------------------------- */
  try {
    const me = await fetch(`${API}/api/v1/me`, { headers: authed });
    if (me.ok) {
      const who = (await me.json()) as { name?: string };
      ok(`authenticated as u/${who.name ?? '(unknown)'}`);
    } else {
      no(`identity check failed (HTTP ${me.status}) — the token may lack the "identity" scope`);
    }
  } catch (err) {
    no(`identity check errored: ${(err as Error).message}`);
  }

  /* --- one real search, inside policy ----------------------------------- */
  const desk = buildDesk(deskId);
  const subreddit = searchableSubreddits(desk).allowed[0];

  if (!subreddit) {
    no('every configured subreddit for this desk is blocked by policy — nothing to search');
    return 1;
  }

  try {
    const query = desk.lens.keywords[0] ?? 'help';
    const url = `${API}/r/${subreddit}/search?${new URLSearchParams({
      q: query, restrict_sr: '1', sort: 'new', t: 'day', limit: '10',
    })}`;

    const res = await fetch(url, { headers: authed });
    const used = res.headers.get('x-ratelimit-used');
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');

    if (!res.ok) {
      no(`search failed (HTTP ${res.status}) on r/${subreddit}`);
      console.log(`    ${(await res.text()).slice(0, 200)}`);
      return 1;
    }

    const body = (await res.json()) as { data?: { children?: unknown[] } };
    const count = body.data?.children?.length ?? 0;
    ok(`search on r/${subreddit} for "${query}" returned ${count} post${count === 1 ? '' : 's'}`);

    if (remaining !== null) {
      ok(`rate limit — used ${used}, remaining ${remaining}, resets in ${reset}s`);
      console.log(`
    Set the desk's budget from what Reddit actually assigned:
      DICE_REDDIT_${deskId.toUpperCase().replace(/-/g, '_')}_RATE="<requests>/<seconds>"
`);
    } else {
      no('Reddit returned no X-Ratelimit headers — cannot confirm the assigned limit');
    }
  } catch (err) {
    no(`search errored: ${(err as Error).message}`);
    return 1;
  }

  console.log('\n  Desk is ready for the automated adapter.\n');
  return 0;
}

main().then((code) => process.exit(code));
