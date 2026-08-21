# Safety policy

This system is aimed, by design, at people on the worst day of their month. A
share of them will be in genuine crisis. For those people the correct product
behaviour is to stop being a product.

Implemented in `src/pw/safety.ts`, enforced in `src/state/sessionStore.ts` and
`src/pw/funnel.ts`, tested in `src/pw/safety.test.ts`.

## The rule

**A session that trips the safety screen never runs an exercise, never reaches
a checkpoint, and never sees a commercial offer — in that session or any later
stage of it.**

Three independent places enforce this, deliberately:

1. `submitStatement` screens before classifying. A routed session never gets a
   pressure, a persona, or an intervention bound to it.
2. `SessionFlow` checks `safetyRouted` before it renders any stage.
3. `evaluateOffer` refuses on `safetyRouted` before it evaluates anything else.
4. `POST /api/enroll` re-runs that same gate server-side, so a routed session
   cannot be charged even if the browser is bypassed entirely.
5. `POST /api/checkin` screens every daily note and pauses the week on a trip.

Any one of these would be sufficient. All five exist because the failure mode
— an offer shown to, or a charge taken from, someone who said they wanted to
die — is not one to leave to a single conditional.

## Tuned for recall, not precision

The screen over-triggers on purpose. A false positive costs one person a
slightly jarring screen with a helpline on it. A false negative runs a
breathing exercise and then a sales prompt at someone in crisis.

`src/pw/safety.test.ts` locks in both directions: crisis phrasings must route,
and ordinary distress ("I just got laid off and I'm freaking out", "this job is
killing me") must *not* be routed away from the help it came for.

## Categories screened

`self-harm`, `harm-to-others`, `abuse`, `medical-emergency`, `acute-substance`.
A medical emergency leads with local emergency services rather than a
counselling line.

## What this is not

A regex screen is a floor, not a safety system. It catches plain statements. It
will miss euphemism, indirection, and anything phrased carefully — which is how
a great many people in crisis actually write.

## Required before this is pointed at real people

- [ ] **Localise the resource list.** `SUPPORT_RESOURCES` is US/UK-weighted.
      Every number needs verifying, on a recurring schedule — helplines change.
- [ ] **Add a human escalation path.** Right now the system hands over a phone
      number. Anything running continuity check-ins needs a route to a person.
- [x] **Re-screen continuation check-ins.** Done: `POST /api/checkin` screens
      every note server-side. A trip pauses delivery permanently, refuses
      further check-ins, sends one message containing only helplines, and does
      not store the note. Covered in `server/routes.test.ts`.
- [ ] **Decide the refund policy for a safety pause.** Delivery stops; the
      charge currently stands. That is a policy call, not a code change.
- [ ] **Review by someone clinically qualified.** Every intervention, every
      empathy line, and the screen itself. Nothing here has had that review.
- [ ] **Decide the minor policy.** "Starting college" is an explicit front
      door, which means under-18s will arrive. That needs an answer before
      launch, not after.
- [ ] **Instrument the routing rate.** If sessions route at a rate far above or
      below expectation, the screen is miscalibrated and nobody will notice
      without the number.

## Standing disclosures

- Every persona is disclosed as AI on every screen where it speaks
  (`src/ui/Disclosure.tsx`), not once in a footer.
- The footer carries the "not therapy, counselling, or medical care" line plus
  a crisis route on every page of the app.
- The 7-day offer states plainly that the guides are AI, that the week ends by
  itself, and that a person's words are not used to market back to them.
