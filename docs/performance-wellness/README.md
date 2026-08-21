# Performance Wellness Operating System

A pressure-responsive engine. A person says what is bearing down on them, gets
routed to one of ten guides, is handed one usable exercise, and is asked
honestly whether anything changed. Only if something did are they offered
anything.

Organised around **pressure moments, not demographics**. Ten front doors, one
engine behind them.

## The layers

| Layer | Where | What it does |
|---|---|---|
| Safety | `src/pw/safety.ts` | Screens for crisis signals and routes out of the funnel. Runs first, always. |
| Pressure taxonomy | `src/pw/pressure.ts` | Ten front doors and a deterministic classifier that picks one from a person's own words. |
| Personas | `src/pw/personas.ts` | The ten guides: voice, function, visual identity, channels, operational mailbox. |
| Interventions | `src/pw/interventions.ts` | Ten micro-interventions, 90s–3min, one per guide. |
| Funnel | `src/pw/funnel.ts` | The eight stages and the offer gate. |
| Prompt engine | `src/pw/promptEngine.ts` | Assembles persona prompts for content work; composes in-product copy deterministically. |
| Continuity | `src/pw/continuity.ts` | The 7-Day Under Pressure Reset, built per pressure moment. |
| Calendar | `src/pw/calendar.ts` | The weekly publishing rhythm per guide. |
| SoulHost | `src/pw/soulhost.ts` | The single human-facing voice. The ten guides work behind it. |
| Session | `src/state/sessionStore.ts` | Anonymous journey state, signed event ledger. Never transmitted. |
| Week | `src/state/weekStore.ts` | A paid week in progress, served from the enrolment. |
| Screens | `src/screens/` | One per funnel stage, plus enrolment and the week. |
| Console | `src/console/` | Operator view: guides, calendar, prompt studio, session ledger. |
| **Server** | `server/` | Persistence, identity, payment, delivery — see below. |

## The server

| Layer | Where | What it does |
|---|---|---|
| Store | `server/store/` | `EnrollmentRepository` + an atomically-written file implementation. |
| Identity | `server/identity.ts` | Opaque resume tokens. No accounts, no passwords. |
| Payments | `server/payments/` | Stripe Checkout over REST, plus a local stand-in for running without credentials. |
| Delivery | `server/delivery.ts`, `server/scheduler.ts` | When each day unlocks, and the idempotent sweep that sends it. |
| Mail | `server/mail/` | Resend over HTTP, or a file outbox when unconfigured. |
| Routes | `server/routes.ts` | Enrol, webhook, resume, today, check-in. |

## Two decisions worth knowing before reading the code

**The in-product copy is not model-generated.** `compose()` assembles what a
person reads from hand-written strings in `promptEngine.ts` and the reviewed
pressure records. The full set of things this system can say to someone in
distress is therefore enumerable and reviewable in advance. The model-facing
side (`buildPrompt`) is for *content production*, where a human reviews the
output before it ships. Nothing calls a model at runtime.

**The guides are capabilities, not a cast.** All ten do real work — they select
the copy, the exercise, and the shape of the week, and the ledger records which
one earned a transaction. None of them is introduced to the person by name.
SoulHost holds continuity at the human-facing edge; asking someone in distress
to form ten relationships is asking for something they do not have to give.

**The classifier is keyword-scored, not learned.** Deliberately: the routing
decision for someone in distress should be explainable, testable, and
correctable without a model in the loop. The chosen door is also shown to the
person with a "not quite" control, because a system that silently mis-routes
and then insists is worse than one that asks.

## Running it

```bash
npm install
npm run dev      # web on :3000, API on :3001
npm run check    # typecheck + tests
```

No credentials are required for any of it. Payments use a local stand-in and
daily messages are written to `.data/outbox/` until Stripe and mail keys are
set — see `.env.example`. The session engine has no runtime model dependency.

## Documents

- [Funnel doctrine and the offer gate](./funnel-doctrine.md)
- [Safety policy](./safety-policy.md) — **read before pointing this at real people**
- [The ten guides](./personas.md)
- [Commercial continuity](./commercial-continuity.md) — persistence, identity, payment, delivery
- [Distribution policy](./distribution-policy.md) — what was built, what was not, and why

## Status

The full commercial path runs end to end: arrive → one intervention → reported
improvement → offer → pay → return tomorrow with context intact → receive Day 2.

What is **not** built: refunds, a datastore that survives concurrent instances,
email deliverability handling, rate limiting, data deletion, and anything that
posts to a platform. The safety policy lists what has to happen before real
users; `commercial-continuity.md` lists the rest.
