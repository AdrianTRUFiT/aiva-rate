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
npm run dev      # http://localhost:3000
npm run check    # typecheck + tests
```

No API key needed — there is no runtime model dependency. The words a person in
distress reads are composed from reviewed strings, not generated on the fly.

## Two things to know

**The offer is gated in code.** `evaluateOffer()` in `src/pw/funnel.ts` permits
a commercial offer only after a completed exercise produced a *reported*
improvement. Reported no change, felt worse, or routed to crisis support: no
offer, on any path. Two of the three checkpoint answers end without a sale,
which is what makes the third credible.

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
- [Distribution policy](docs/performance-wellness/distribution-policy.md) — what was built, what was not, and why

## Status

The session engine is complete and tested end to end (39 tests). Not built:
persistence, accounts, payment, delivery of the 7-day sequence outside the
browser, and anything that posts to a platform.
