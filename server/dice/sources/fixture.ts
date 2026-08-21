import { createHash } from 'node:crypto';
import type { AuthStatus, Desk, DeskId, RawSignal } from '../types';
import type { DiscoveryRequest, DiscoveryResult, SignalSource } from './types';

/**
 * The fixture source.
 *
 * Emulates ten separate account workspaces well enough that the entire operator
 * workflow can be walked without Reddit access: each desk sees a different pool
 * shaped by its own lens, pools are large enough that the reduction from raw to
 * priority is a real reduction, and the pools deliberately overlap on a handful
 * of authors and threads so cross-desk collisions actually occur.
 *
 * It also includes material that must be filtered out — promotional posts,
 * stale posts, off-lens posts, and posts carrying crisis language — because a
 * pipeline that only ever sees clean input is not a pipeline that has been
 * tested.
 *
 * Deterministic: the same desk and day produce the same pool, so an operator's
 * queue does not reshuffle underneath them between requests.
 */

const seeded = (seed: string): (() => number) => {
  let h = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16);
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0x100000000;
  };
};

const pick = <T,>(rand: () => number, items: T[]): T => items[Math.floor(rand() * items.length)];

/** Bodies that read as a real person with the desk's problem. */
const ON_LENS: Record<DeskId, { title: string; body: string }[]> = {
  stabilizer: [
    { title: 'Got laid off this morning with no warning', body: "Fifteen minutes in a meeting room and that was it. I have no idea what to do first. Do I file for unemployment today? Do I tell people? My head is going in about nine directions at once and I cannot get it to stop long enough to make one decision. Any advice on what actually needs doing in the first 24 hours?" },
    { title: 'Just found out my role is being eliminated', body: 'They gave me four weeks. I have been here six years. I keep opening the job boards and closing them again because I do not even know what I would search for. How do you get past the first day of this?' },
    { title: 'Blindsided by a restructure, feeling completely untethered', body: "I was told this morning. I have a mortgage and I am the only earner and my brain has decided to solve all of that before lunch. What should I do tonight that is actually useful rather than just panicking productively?" },
  ],
  clarifier: [
    { title: 'Everything is piling up and I cannot pick a starting point', body: 'Work deadlines, a house move, my mother is ill, and I have not done my taxes. Every time I sit down to start one, the other three shout louder. Not sure what to do. How do you decide what actually matters first when it all feels equally on fire?' },
    { title: 'Too much on and I have started freezing instead of working', body: 'I sit at my desk and just do not begin. It is not laziness, there is genuinely too much, and I think my brain has given up ranking it. Looking for a way to sort it that is not another app.' },
  ],
  companion: [
    { title: 'I have nobody I can actually say any of this to', body: "Moved cities for work eight months ago. I have colleagues, not friends. Something hard happened last week and I realised there is literally no one I would call about it. Anyone else been through this stretch? How long does it take?" },
    { title: 'Going through something big and carrying it entirely alone', body: 'I do not want advice on the thing itself. I think what is actually getting to me is that nobody in my life knows about it, and pretending everything is normal all day is heavier than the thing.' },
  ],
  rebuilder: [
    { title: 'My business failed and I do not know who I am now', body: 'Four years, gone. I know objectively I learned a lot but right now I mostly feel like someone who wasted his thirties. How do you start rebuilding when the thing you built your identity on is gone?' },
    { title: 'Starting over at 41 and struggling to believe I can', body: 'The skills are still there, I know that on paper. Getting myself to act like it is another matter. Need help finding the first step that does not feel enormous.' },
  ],
  navigator: [
    { title: 'Two offers and I have been going back and forth for a week', body: 'One pays more and I would probably hate it. One is less money and better people. I have made a spreadsheet, which has not helped. What should I do when both options genuinely cost something?' },
    { title: 'Stuck between staying and leaving and paralysed by it', body: 'Been at this crossroads for three months. Every time I nearly decide, I find a reason it might be wrong. Any advice on how to actually make a call rather than keep re-running it?' },
  ],
  regulator: [
    { title: 'Completely burned out and running on empty for months', body: 'I get through the day and have nothing left. Weekends do not fix it any more. Dreading Monday by Saturday lunchtime. This is not a willpower thing at this point, my body is just done. How do you come back from this while still having to work?' },
    { title: 'Exhausted in a way sleep does not touch', body: 'Nine hours a night and I wake up tired. Chest is tight most of the day. I know the answer is probably "do less" but I need something I can do in the next hour, not a life restructure.' },
  ],
  architect: [
    { title: 'Starting college next week and I have no routine at all', body: 'I have never had to structure my own days before. School did it for me. I am genuinely worried I will just drift for a term. Where do I start with building something I will actually stick to?' },
    { title: 'First week at a new job and everything is a decision', body: 'When to eat, when to start, when to stop, when to ask. It is exhausting in a way I did not expect. Any tips for the first seven days?' },
  ],
  unraveler: [
    { title: 'Mind will not shut off, lying awake until 3am every night', body: "It is not one thought, it is about four all braided together and they keep coming back round. I am tired enough to sleep and my head just will not stop. How do you actually get them out of your head?" },
    { title: 'Overthinking everything to the point of exhaustion', body: 'Replaying conversations, pre-running conversations that have not happened. I know it is not useful. Knowing that has not made it stop. Struggling with this for weeks now.' },
  ],
  encourager: [
    { title: 'Got the role and now I am convinced they made a mistake', body: 'Two weeks in and waiting to be found out. I have done hard things before but my brain has filed all of those under "that was different". How do I get past this?' },
    { title: 'Talked myself out of applying again', body: 'Third time. I read the description, decided I was not qualified, closed the tab. I do this every time and I am tired of it. Need help breaking the pattern.' },
  ],
  'continuity-guide': [
    { title: 'Kept it up for three weeks then fell off completely', body: 'Had a good run, missed two days, and now it has been a fortnight. The falling off is not the problem, the not-restarting is. How do you get back on without making it a whole thing?' },
    { title: 'Lost all momentum after a good month', body: 'Nothing bad happened, the initial pressure just went away and so did the habit. Trying to figure out how to keep going when it stops being urgent.' },
  ],
};

/** Material the pipeline must reject. Every desk's pool gets some. */
const NOISE: { title: string; body: string; kind: string }[] = [
  { kind: 'promo', title: 'I built an app that fixes burnout', body: 'Been working on this for months. Check out my landing page, link in bio. Looking for beta testers, DM me for a discount code.' },
  { kind: 'promo', title: 'My newsletter on productivity just hit 10k', body: 'Sign up here for weekly tips. Also launching a course soon, comment if you want early access.' },
  { kind: 'survey', title: 'Survey for my dissertation on workplace stress', body: 'Ten minutes, completely anonymous. Would really appreciate the responses, link below.' },
  { kind: 'off-lens', title: 'Which laptop should I buy for uni?', body: 'Budget is about 900. Mostly essays and some light photo editing. Any recommendations?' },
  { kind: 'off-lens', title: 'Is this salary offer reasonable for my area?', body: 'Recruiter came back with a number and I want a sanity check before I respond.' },
  { kind: 'thin', title: 'rough day', body: 'thats it really' },
  { kind: 'thin', title: 'anyone else just tired', body: 'yeah' },
];

/**
 * Posts carrying crisis language. These exist in the fixture on purpose: the
 * screen has to be exercised against real-shaped input, and an operator has to
 * see that the count of screened-out signals is non-zero and understand why.
 */
const CRISIS: { title: string; body: string }[] = [
  { title: 'I do not think I can keep doing this', body: "Everything has come apart at once and I honestly don't want to be here anymore. I don't know why I'm posting this." },
  { title: 'Cannot see a way forward', body: 'Lost the job, then the relationship. Been thinking about ending it. Not sure what I expect anyone to say.' },
];

/** Authors deliberately shared between desks so collisions actually occur. */
const SHARED_AUTHORS = ['throwaway_march12', 'quietuser_88', 'nothing_left_2026'];

const HANDLE_PARTS = ['quiet', 'tired', 'grey', 'north', 'slow', 'half', 'open', 'late', 'still', 'plain'];

function author(rand: () => number, index: number): string {
  // Every seventh post reuses a shared author, producing cross-desk overlap.
  if (index % 7 === 3) return pick(rand, SHARED_AUTHORS);
  return `${pick(rand, HANDLE_PARTS)}_${pick(rand, HANDLE_PARTS)}_${Math.floor(rand() * 900 + 100)}`;
}

/** How many raw signals a desk's pool holds. Large enough that reduction matters. */
const POOL_SIZE: Record<DeskId, number> = {
  stabilizer: 527,
  clarifier: 184,
  companion: 263,
  rebuilder: 149,
  navigator: 211,
  regulator: 692,
  architect: 611,
  unraveler: 338,
  encourager: 274,
  'continuity-guide': 96,
};

export class FixtureSignalSource implements SignalSource {
  readonly name = 'fixture';

  async status(desk: Desk): Promise<AuthStatus> {
    // The fixture reports whatever the credential store resolved, so an
    // unconfigured desk still shows as unconfigured rather than pretending.
    return desk.auth === 'not-configured' ? 'connected' : desk.auth;
  }

  async discover({ desk, subreddits, budget, now }: DiscoveryRequest): Promise<DiscoveryResult> {
    if (subreddits.length === 0 || budget <= 0) {
      return { signals: [], spent: 0, truncated: budget <= 0 };
    }

    const day = now.toISOString().slice(0, 10);
    const rand = seeded(`${desk.id}:${day}`);
    const poolSize = POOL_SIZE[desk.id];

    const onLens = ON_LENS[desk.id];
    const signals: RawSignal[] = [];

    // The budget is a hard ceiling. A desk with 40 requests left does not get
    // 527 posts, and the shortfall is reported rather than hidden.
    const take = Math.min(poolSize, budget);

    for (let i = 0; i < take; i++) {
      const roll = rand();
      const subreddit = pick(rand, subreddits);
      const ageHours = roll < 0.35 ? rand() * 6 : roll < 0.7 ? rand() * 40 : rand() * 260;
      const createdAt = new Date(now.getTime() - ageHours * 3_600_000).toISOString();

      let content: { title: string; body: string };
      if (roll < 0.02) content = pick(rand, CRISIS);
      else if (roll < 0.35) content = pick(rand, NOISE);
      else {
        content = pick(rand, onLens);
        // Real help posts vary from a couple of lines to several paragraphs,
        // and length is a genuine intent signal. A fixture where every post is
        // the same length would never exercise that half of the scorer.
        if (rand() < 0.4) {
          const more = pick(rand, onLens);
          content = { title: content.title, body: `${content.body}\n\n${more.body}` };
        }
      }

      signals.push({
        sourceId: `fixture:${desk.id}:${i}`,
        subreddit,
        // Shared thread ids on a slice of posts, so thread collisions occur too.
        postId: i % 23 === 5 ? `shared_${i % 3}` : `${desk.id.slice(0, 3)}${i}${Math.floor(rand() * 9000)}`,
        author: author(rand, i),
        title: content.title,
        body: content.body,
        permalink: `https://reddit.com/r/${subreddit}/comments/fixture_${desk.id}_${i}`,
        createdAt,
      });
    }

    return { signals, spent: take, truncated: take < poolSize };
  }

  /** The fixture has no write path, and says so rather than pretending to post. */
  async reply(): Promise<{ ok: false; error: string }> {
    return { ok: false, error: 'The fixture source cannot post to Reddit. Connect a real account first.' };
  }
}
