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
| Session | `src/state/sessionStore.ts` | Journey state, signed event ledger. |
| Screens | `src/screens/` | One per funnel stage. |
| Console | `src/console/` | Operator view: guides, calendar, prompt studio, session ledger. |

## Two decisions worth knowing before reading the code

**The in-product copy is not model-generated.** `compose()` assembles what a
person reads from hand-written strings in `promptEngine.ts` and the reviewed
pressure records. The full set of things this system can say to someone in
distress is therefore enumerable and reviewable in advance. The model-facing
side (`buildPrompt`) is for *content production*, where a human reviews the
output before it ships. Nothing calls a model at runtime.

**The classifier is keyword-scored, not learned.** Deliberately: the routing
decision for someone in distress should be explainable, testable, and
correctable without a model in the loop. The chosen door is also shown to the
person with a "not quite" control, because a system that silently mis-routes
and then insists is worse than one that asks.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # typecheck + tests
```

No API key is required — the app has no runtime model dependency.

## Documents

- [Funnel doctrine and the offer gate](./funnel-doctrine.md)
- [Safety policy](./safety-policy.md) — **read before pointing this at real people**
- [The ten guides](./personas.md)
- [Distribution policy](./distribution-policy.md) — what was built, what was not, and why

## Status

The session engine is complete and tested end to end. What is **not** built:
persistence (state is in-memory, a reload starts over), accounts, payment,
delivery of the 7-day sequence outside the browser, and anything that posts to
a platform. The safety policy lists what has to happen before real users.
