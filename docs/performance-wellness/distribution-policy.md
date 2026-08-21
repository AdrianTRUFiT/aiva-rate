# Distribution policy — what is built here, and what is not

The source specification described a ten-account distribution layer. Most of it
is built. Four specific mechanisms are not, and this document records which,
why, and what replaced them, so the decision is visible rather than silently
absorbed into the code.

## The concern, stated once

The specification's distribution layer describes ten personas presented as
independent voices, an "engagement swarm" in which those personas comment
supportively on each other's posts, explicit anti-detection rules ("Persona
Depth — build believable identities", "avoid detection"), and 10–20 automated
DMs per day sent to people who have just posted about a layoff, a breakup, or a
burnout.

Run together, those four things are coordinated inauthentic behaviour. That is
not a stylistic objection:

- **It is against the rules of every platform named.** Meta, TikTok, Reddit,
  LinkedIn and X all prohibit operating multiple accounts to create a false
  impression of independent support. Enforcement is at the network level — when
  one account is actioned, the linked ones usually go with it, which puts the
  whole distribution layer on a single point of failure.
- **The fabricated peer testimony is the legally exposed part.** A persona
  commenting "this helped me" on the brand's own content is an undisclosed
  endorsement by a party with a material connection to the seller. In the US
  that engages the FTC's Endorsement Guides, and the 2024 rule on fake reviews
  and testimonials reaches exactly this pattern.
- **The context makes it worse, not lighter.** The audience is defined as
  people at their least resourced — the hour after a job loss, the week of a
  divorce. Manufactured social proof aimed at someone in that state is the
  version of this that is hardest to defend afterwards.
- **It undercuts the doctrine it is meant to serve.** The commercial thesis is
  "earn the transaction through transformation" — trust as the actual product.
  A swarm of accounts simulating strangers who agree is the one thing that,
  once noticed, destroys precisely that asset.

So the engagement swarm, the cross-persona validation, the anti-detection
rules, and the automated cold-DM engine are not implemented. Everything else in
the specification is.

## What is built instead

| Specified | Built |
|---|---|
| 10 personas as independent identities | 10 named guides under one brand, each disclosed as AI wherever they speak (`src/ui/Disclosure.tsx`) |
| Backend Gmail per persona, invisible to users | Kept as `Persona.mailbox` — operational routing only, never surfaced |
| Engagement swarm, cross-persona comment waves | Not built. One account per channel per persona, publishing on a stated cadence (`src/pw/calendar.ts`) |
| Anti-detection / staggering to avoid enforcement | Not built. Anti-duplication survives as a *content quality* rule in the prompt engine — vary hooks and metaphors so the writing is not repetitive |
| 10–20 automated DMs/day to people in crisis | Not built, and now structurally impossible: DICE denies messaging in every subreddit by policy, and crisis signals are screened out before they can be queued at all. See [dice.md](./dice.md) |
| "Funnel automation detects micro-transformation, triggers offer" | Built, and gated — `evaluateOffer` in `src/pw/funnel.ts` |
| Optimisation engine logging which persona earned the transaction | Built as a signed session ledger (`OFFER_ACCEPTED` carries `attributedPersona`) |

## Outbound, done the defensible way

DICE (added later — see [dice.md](./dice.md)) is the outbound layer, built
within these limits rather than around them. Ten desks listen through ten
different lenses; a cross-desk collision check stops two of them ever working
the same person; channel actions default to denied and messaging is off
everywhere; crisis posts are screened out rather than prioritised. What it does
not do is manufacture agreement between desks, which is the line below.

## The line, in one rule

**A persona may say anything a disclosed brand voice may say. It may never
simulate a bystander.**

Publishing an exercise as The Stabilizer is marketing. Having The Clarifier
reply "this really helped me" underneath it is fabricated testimony. The first
is the whole content strategy; the second is what is excluded.

## If the swarm is wanted anyway

That is the operator's call to make, not this codebase's. Two things would need
to be true first, and neither is a matter of implementation:

1. Every persona account visibly identifies as part of the same brand, so
   cross-interaction is transparent rather than simulated.
2. Nothing that reads as a peer endorsement is posted by an account the
   business controls.

At which point it is a content calendar with cross-promotion, which is what
`src/pw/calendar.ts` already is.
