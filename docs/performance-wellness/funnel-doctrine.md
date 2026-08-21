# The funnel, and the gate

> Empathy creates connection. Understanding creates trust. Education creates
> capability. Action creates evidence. Small results create belief.
> Transformation earns the transaction. Continued results earn the relationship.

Implemented in `src/pw/funnel.ts`; the screens are in `src/screens/`.

## The eight stages

| Stage | What happens | Screen |
|---|---|---|
| `THRESHOLD` | One question: what is putting the most pressure on you right now? | `Threshold.tsx` |
| `REFLECTION` | Empathy + understanding, in the assigned guide's voice | `Reflection.tsx` |
| `EDUCATION` | One idea, small enough to keep | `Education.tsx` |
| `ACTION` | The micro-intervention, guided step by step on a timer | `Action.tsx` |
| `CHECKPOINT` | Did anything shift? | `Checkpoint.tsx` |
| `TRANSFORMATION` | The result is recorded — and the gate is consulted | `Transformation.tsx` |
| `OFFER` | The 7-Day Under Pressure Reset | `Offer.tsx` |
| `CONTINUATION` | Daily one-minute check-ins | `Continuation.tsx` |

## The gate

`evaluateOffer()` is the most important function in the codebase. An offer is
permitted only when **all** of these hold:

- the session was not routed to support, **and**
- an intervention was completed, **and**
- the checkpoint was answered, **and**
- the answer was `shifted`.

Every other path ends without anything being sold:

| Situation | What happens instead |
|---|---|
| Routed to support | Crisis resources. The commercial system is off for the session. |
| Nothing completed yet | Another exercise. |
| Reported feeling worse | Stop. Resources offered, nothing sold. |
| Nothing changed, attempts remain | A *different* exercise — never the same one twice. |
| Nothing changed after 3 attempts | An honest close: "that didn't land, and that's a real answer." |

Two of the three checkpoint answers end the session with no offer. That is what
makes the third one credible.

## Why the gate is code and not a guideline

The doctrine — *earn the transaction through transformation* — is the entire
product thesis. A thesis enforced by whoever is writing the page copy that week
is a thesis that erodes. So it lives in one pure function, it is re-checked in
`Offer.tsx` rather than trusted from the previous screen, and
`src/pw/funnel.test.ts` asserts every path through it.

## The checkpoint is a measurement, not a conversion step

The three answers on `Checkpoint.tsx` are weighted evenly and "no change" is
given an encouraging subtitle. A UI that nudged toward "yes" would corrupt the
one measurement the commercial model rests on — and would optimise the system
toward interventions that *feel* like they worked rather than ones that do.

## Attribution

An accepted offer writes an `OFFER_ACCEPTED` event carrying `attributedPersona`
and `attributedIntervention`. That is the feedback loop the specification asked
for: which front door and which exercise actually earned the transaction.
Visible in the console under **Session ledger**.
