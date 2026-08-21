# DICE — the ten-desk prospecting console

Ten company-operated Reddit identities, each an independent operating desk with
its own authenticated status, listening lens, rate budget, and queue. An
operator opens one desk and gets a prioritised queue of real opportunities to
process; switching desks loads that desk's own state, blended with nothing.

```
                         DICE
                  MULTI-DESK CONSOLE
                          │
      ┌───────────────────┼───────────────────┐
      ▼                   ▼                   ▼
  u/steady_reset    u/downshift_daily   u/first_seven_days
  sudden-shock         burnout           new-beginning
      │                   │                   │
  513 discovered      671 discovered      … own pool
      │                   │                   │
  99 relevant         … own reduction         │
  19 strong               │                   │
  12 worth today          │                   │
      └───────────────────┼───────────────────┘
                          ▼
                collision check (the only shared thing)
                          ▼
                        AIOP
                          ▼
                        RATE
```

## The reduction

This is the productivity claim, and the console leads with it:

```
513 discovered → 99 relevant → 19 strong → 12 worth today   (5 screened out)
```

Order is not negotiable: **dedupe → screen → score**. Policy runs before scoring
so a crisis post or a blocked subreddit is never ranked at all. A "high
priority" crisis post must not be able to exist in this system even transiently.

| Stage | What happens |
|---|---|
| Dedupe | Within the run and against the desk's stored queue. Re-discovering a post never resets an operator's work on it. |
| Screen | Blocked subreddits and crisis language. Terminal — see below. |
| Score | Fit, intent, recency. Readable rules, no model. |
| Reject | Promotional and bot-shaped posts are rejected outright, not ranked low. |
| Queue | Priority ≥ 75, strong ≥ 70, relevant ≥ 45. |

Thresholds are in `server/dice/scoring.ts` with the reasoning for each.

## Ten desks, nothing pooled

Each desk owns its credentials, its grants, its rate budget, its lens, and its
queue. The **only** shared structure is the collision index.

**Rate limits are per-desk and never pooled.** When a desk is spent, discovery
for that desk defers until its own window resets. It does not continue on
another desk's allowance. `spend()` in `server/dice/budget.ts` takes a single
desk and has no parameter that could express "try another one" — the API cannot
say it, so no caller can do it by accident. `budget.test.ts` asserts this.

A configured limit always wins, including in fixture mode: a desk that has been
told its real limit respects it even while simulated.

## The collision check

The one thing the desks share, and the reason they share it: two desks
unknowingly working the same person is what would make ten legitimate desks look
coordinated from the outside.

- Indexed on **author** and on **thread**, but only for desks that actually
  *engaged* — activated, replied, following up, qualified, closed.
- Two desks merely *discovering* the same post is not a collision. Blocking on
  that would make every queue useless.
- A collision denies both channel actions and surfaces the conflicting desk on
  the card. It is a check, not a lock: a human decides what happens next.

## Channel actions are explicit and default-denied

DICE may always discover, score, queue and recommend. Replying and messaging
require **every** gate to pass:

1. the signal was not screened out, **and**
2. no other desk has engaged this person or thread, **and**
3. the desk's account is connected, **and**
4. the desk holds the relevant grant from Reddit, **and**
5. the subreddit is explicitly marked as permitting that action.

The first failure wins and its reason is what the operator reads on the card.
An unlisted subreddit permits nothing — silence is denial, not permission.

**Direct messaging is disabled everywhere.** Not unimplemented: disabled, by
policy, with that stated in the refusal. Unsolicited DMs to people posting about
a bad week is what `distribution-policy.md` already excluded.

## The subreddit floor

`BLOCKED_SUBREDDITS` in `server/dice/policy.ts` is never searched, never
surfaced, never contacted — regardless of desk configuration or operator action.
It covers acute crisis peer-support and clinical communities. A desk's
`exclusions` list is operator-editable; this is not, and a blocked entry in a
desk's configured subreddits is *refused before discovery* rather than queried
and then filtered.

> The list is a starting floor written from general knowledge of these
> communities. It is not a substitute for reading each subreddit's current
> rules, and it needs review by someone who actually participates in them.
> `ALLOWED_SUBREDDITS` entries carry a `verified` field for recording when
> somebody last did that; an empty one means nobody has.

## Safety runs the other way round here

In the inbound product a crisis signal is the most urgent thing in the system.
In DICE it means **do not contact**. Somebody in crisis posting publicly is not
a lead. Such a signal:

- is screened before scoring and carries priority 0
- is never queued and never rankable
- has both channel actions denied
- is **terminal**: no operator click can move it back into a working queue, and
  the API returns 403 if one tries

It stays visible under the "Screened out" filter with its reason, so the count
is auditable rather than silently disappearing.

## AIOP

After DICE surfaces an opportunity, `server/dice/aiop.ts` produces:

- **Reading** — what the person appears to be asking for
- **Contribution** — what this desk can legitimately offer
- **Unknowns** — what we would still need to know
- **Next action** — in plain language
- **Verdict** — act / watch / pass, with the rationale

Deterministic, reusing the inbound classifier and intervention library, so an
operator can see why a recommendation was made and a wrong one is fixable by
editing a rule.

## Credentials

Reddit credentials are read from the environment in `server/dice/credentials.ts`
and never leave that module. A `Desk` carries an `AuthStatus` and nothing else —
no client id, no secret, no token. Persona identity (`accounts.ts`) and Reddit
credentials (`credentials.ts`) are separate objects and the only thing that
crosses between them is a status enum. `routes.test.ts` asserts that no secret
appears in any response body.

## Operator authentication

The console holds ten identities and a lead pipeline, so it is no longer a tab
anyone can click. One shared password, exchanged for a signed httpOnly session
cookie. If `OPERATOR_PASSWORD` is unset, one is **generated at boot and printed
to the server log** — an unconfigured deployment gets a random password, never
no password.

One shared password is modest by design; a real identity provider is the right
answer once more than a few people use it.

## Operator-assisted ingest — the working path today

Automated Reddit discovery is blocked on commercial API access (below). Until
that resolves, DICE runs on real data through operator-assisted ingest: you
browse Reddit as a human, logged into the company account, and paste what you
found.

```
10 pasted → 9 new → 4 relevant → 1 priority   (2 screened out)
```

That is one real morning's paste. The duplicate collapsed, the promotional post
and the off-lens laptop question were rejected, the r/depression post was
blocked, and the crisis post was screened out — all through the **same**
pipeline an automated source feeds. Dedupe, safety screen, subreddit policy,
fit/intent scoring, collision check, queue: identical code, identical order.

**Paste format.** A line that is a URL starts a new post; anything after it is
that post's text. So a bare list of links works, and so does a list of links
with the posts pasted underneath:

```
https://www.reddit.com/r/jobs/comments/abc123/laid_off_this_morning/
u/their_handle
posted: 2h
Fifteen minutes in a meeting room and that was it…

https://www.reddit.com/r/layoffs/comments/def456/role_eliminated/
```

`u/handle` and `posted: 3h` are optional. Tracking parameters are stripped so
`?utm_source=share` cannot defeat deduplication, comment permalinks resolve to
their parent post, and `redd.it` short links are refused with an instruction
rather than silently dropped (they carry no subreddit).

**Scoring degrades honestly.** A bare URL is scored on its title and the card
says *"title only"*; paste the body and the score sharpens. An unknown post age
is neither credited as fresh nor penalised as stale — it gets a middle recency
factor and the card reads *"age unknown"*. A missing body is explicitly not
treated as a short one, because an unread post is not a terse post.

**No API request is made and no rate budget is consumed.** The response says so
in as many words. A budget number that counted requests nobody sent would be a
lie about the one figure keeping this system inside its limits.

**Nothing is fetched server-side.** DICE does not pull post bodies out of Reddit
outside the Data API. That would be the same category of move as rotating
accounts to beat a rate limit. Everything here comes from what the operator
could already see in their own browser.

## The editable lens

Each desk's listening lens is configuration, not code. From the console an
operator can set:

| Field | Effect |
|---|---|
| Subreddits | Which communities this desk watches |
| Keywords / cues | Phrases that raise fit |
| Exclusions | Phrases that disqualify a post |
| Minimum score | Priority floor; below it a signal is rejected with that stated reason |
| Recency window | Posts older than this are dropped (unknown ages are kept) |

The policy floor still wins. Adding a blocked subreddit **fails the whole save**
with the reason per subreddit, rather than being silently stripped — quietly
altering somebody's stated intent is worse than telling them no.

## dice:verify

```bash
npm run dice:verify -- --desk stabilizer
```

Checks one desk's Reddit credentials without ever printing them: token
handshake, which account the token belongs to, one real search inside the
policy-allowed subreddits, and the rate limit Reddit actually assigned. Output
is safe to paste into a ticket — no client id, no secret, no token.

It exists so credentials are verified by whoever holds them rather than handed
to someone else to test with. Not required for operator-assisted ingest.

## The provider seam

DICE never talks to Reddit. It asks a `SignalSource` for signals within a budget
the caller already reserved.

**The real Reddit adapter is not implemented.** It stays behind this seam until
the authorised access model is resolved.

That is not just a credentials question. Reddit names lead generation as
commercial use requiring prior approval and a paid contract — the free 100 QPM
tier is non-commercial only, commercial review is a separate track taking
2–4 weeks with no guarantee, and pricing starts around $0.24/1K calls or
~$12,000/month bundled. *(Reddit blocks Anthropic's crawler, so this is from
secondary sources that agree with each other and with Reddit's help centre —
verify against Reddit's own terms before committing budget.)*

Adding the adapter is a new class implementing `SignalSource` plus a branch in
`sources/index.ts`. Operator-assisted ingest is a second, push-shaped entry
point into the same pipeline, so when the adapter lands nothing downstream of
`runPipeline` changes and both paths coexist.

The **fixture source** emulates ten separate workspaces — different pools,
different emulated limits, deliberately overlapping authors and threads so
collisions genuinely occur, and material that must be filtered out
(promotional, stale, off-lens, and crisis-language posts). Desks running on it
are marked `simulated: true` and the console shows a standing banner saying so.
Nothing about a simulated desk can be mistaken for a live one.

## What is not built

- **The Reddit adapter.** Blocked on commercial API access, above.
- **AIOP handoff.** `Activate` records an operator decision. It does not yet
  hand the lead to AIOP — deliberately, until this real-data path is proven.
- **Posting.** Nothing in DICE writes to Reddit. `activated` records an operator
  decision; the reply is still made by a human in Reddit.
- **Conversation threading.** Follow-ups and conversion history are state
  transitions on a signal, not a separate conversation store. Honest for V1.
- **Per-operator identity.** One shared password, no audit of *which* operator
  did what.
- **Lens editing in the UI.** Lenses are code in `accounts.ts`.
