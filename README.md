# Performance Wellness Operating System

A pressure-responsive wellness engine. Someone says what is bearing down on
them, gets routed to one of ten guides, is handed one usable exercise, and is
asked honestly whether anything changed. Only if something did are they offered
anything.

Built around **pressure moments, not demographics** — ten front doors, one
engine behind them.

```
"I just got laid off"  ─┐
"I'm burned out"        │
"I can't decide"        ├─→  classify → guide → one exercise → did anything shift?
"My mind won't stop"    │                                              │
"I'm starting college" ─┘                        ┌────────────────────┴──────────────┐
                                                 │                                   │
                                          something shifted                    nothing did
                                                 │                                   │
                                          offer the 7 days                 another exercise,
                                                 │                       then an honest close
                                          daily check-ins
```

## Running it

```bash
npm install
npm run dev      # web on :3000, API on :3001
npm run check    # typecheck + tests
```

No credentials needed for any of it. Payments use a local stand-in and daily
messages land in `.data/outbox/` until Stripe and mail keys are set — see
`.env.example`. There is no runtime model dependency: the words a person in
distress reads are composed from reviewed strings, not generated on the fly.

## The commercial path

```
arrive → one intervention → reported improvement → offer → pay
                                                            │
                        ┌───────────────────────────────────┘
                        ▼
        day 1 in the browser · day 2 by email tomorrow · seven days, then it ends
```

Runs end to end today. Move the clock instead of waiting a day:

```bash
curl -sX POST localhost:3001/api/dev/clock \
  -H 'content-type: application/json' -d '{"offsetHours":24}'
```

## Two things to know

**The offer is gated in code, including where the money is.** `evaluateOffer()`
in `src/pw/funnel.ts` permits a commercial offer only after a completed exercise
produced a *reported* improvement, and `POST /api/enroll` re-decides the same
gate server-side before any charge is created. Reported no change, felt worse,
or routed to crisis support: no offer and no checkout, on any path.

**Nothing leaves the browser until the offer is accepted.** The anonymous
journey makes no network requests at all — `enroll` is the first one. What gets
stored then is listed on screen, and it never includes the words typed at the
threshold.

**Crisis routing runs first and wins.** A statement that trips the safety screen
never gets classified, never binds an exercise, and can never reach an offer.
Enforced in three independent places. See
[docs/performance-wellness/safety-policy.md](docs/performance-wellness/safety-policy.md)
— **read it before pointing this at real people.**

## Documentation

- [System overview](docs/performance-wellness/README.md)
- [Funnel doctrine and the offer gate](docs/performance-wellness/funnel-doctrine.md)
- [Safety policy](docs/performance-wellness/safety-policy.md)
- [The ten guides](docs/performance-wellness/personas.md)
- [DICE](docs/performance-wellness/dice.md) — the ten-desk prospecting console
- [Commercial continuity](docs/performance-wellness/commercial-continuity.md) — persistence, identity, payment, delivery
- [Distribution policy](docs/performance-wellness/distribution-policy.md) — what was built, what was not, and why

## DICE

An operator console sitting on top of Reddit: ten company-operated desks, each
with its own authenticated account, listening lens, rate budget and queue. Open
a desk and get a prioritised queue — `513 discovered → 99 relevant → 19 strong →
12 worth today`.

Three rules hold in code: a desk spends only its own rate limit and defers when
spent (never continuing on another desk's), no two desks may unknowingly work
the same person, and channel actions default to denied. Crisis signals mean *do
not contact* — screened before scoring, never queued, terminal.

The real Reddit adapter sits behind a provider seam and is not implemented; the
fixture source emulates ten workspaces so the whole workflow runs today.

## Status

The commercial path runs end to end (164 tests). Not built: refunds, a datastore
that survives concurrent instances, email deliverability handling, rate
limiting, data deletion, and anything that posts to a platform.
