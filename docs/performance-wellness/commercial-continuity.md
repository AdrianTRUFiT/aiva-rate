# Commercial continuity

The step from "an internal browser journey" to "a transaction system":
persistence → identity → payment → delivery outside the browser.

## The acceptance path

> A new person arrives with a pressure statement → completes one intervention →
> reports a meaningful improvement → sees an appropriate 7-Day Reset offer →
> pays → returns tomorrow without losing context → receives Day 2 based on the
> same relationship.

This runs end to end today against the real server, driven through the real UI.
`npm run dev`, walk it, and move the clock with the dev route rather than
waiting a day:

```bash
curl -sX POST localhost:3001/api/dev/clock \
  -H 'content-type: application/json' -d '{"offsetHours":24}'
```

## Nothing leaves the browser until the offer is accepted

The threshold screen says the session stays in the browser. That is enforced by
the client making no requests at all until `enroll` — the anonymous journey is
never transmitted, so there is nothing server-side to leak, subpoena, or breach
for anyone who did not enrol.

At enrolment the promise is retired explicitly, on screen, listing what is now
stored. What is stored:

- the email address, so a message can reach them
- the **derived** routing state — which door, which exercise — never the words they typed
- check-in notes, which are theirs and are read back to them

The raw threshold statement is never transmitted and has no column to live in.

## Identity without accounts

A returning person is recognised by an opaque 32-byte resume token, delivered in
an httpOnly cookie and embedded in every email link. Only its SHA-256 is stored.
No password, no account, and a leaked database hands out no live sessions.

This is a bearer credential. That is the right trade for a seven-day plan and
the wrong one for anything holding money or medical records — see the caveat in
`server/identity.ts`.

## The gate is enforced where the money is

`evaluateOffer()` already refused to *show* an unearned offer. It now also
refuses to *charge* for one: `POST /api/enroll` re-decides the gate server-side
and returns 403 with the refusing rule before any checkout session is created.

The threat model is worth being explicit about, because it is inverted from the
usual one. The gate protects the person from the business, not the business from
the person — forging the evidence only lets somebody buy a thing they could have
bought anyway. What must never happen is the *server* creating a charge on a path
the gate would have refused, and that is what the re-check prevents.

A `safetyRouted` session is refused first, before anything else is evaluated.

## Payment

Stripe Checkout, called over its REST API — no SDK, so the dependency list is
unchanged. Card details never reach this app.

Payment is confirmed **only** by a signature-verified webhook. The browser
returning from the success URL activates nothing; it polls until the webhook has
landed. Webhook signatures are verified against the raw request bytes with a
5-minute replay window, and a repeated delivery is a no-op — Stripe retries
until it gets a 2xx, so duplicates are routine rather than exceptional.

**Without `STRIPE_SECRET_KEY`** a local stand-in is used instead: a page that
replaces Stripe Checkout and confirms by firing a signed webhook through the
same verification path. It exists so this whole flow is testable with no
account. The dev route is mounted only when there is no Stripe key, so a
deployment taking real payments cannot reach it.

## Delivery outside the browser

A sweep runs every 60 seconds. For every active enrolment it finds days that
have unlocked but not been sent, sends them, and records the send.

- **Time-based, not streak-based.** Day N unlocks at `startedAt + (N-1)×24h`.
  Completing the previous day is deliberately not a precondition, because the
  offer promises "miss one and nothing resets" — gating on completion would
  turn a supportive week into a streak mechanic.
- **Idempotent.** The delivery record lives on the enrolment and the mailer gets
  a per-enrolment-per-day key, so a repeated sweep cannot mail the same exercise
  twice.
- **Recorded after success.** A failed send is not recorded, so it retries; one
  bad address does not stall the sweep for anyone else.
- **Missed days are caught up**, not skipped: away three days, you get the three.

Without `RESEND_API_KEY`, messages are written to `.data/outbox/` as text files.
The scheduler, composition, and idempotency all still run — only the final hop
changes.

## Safety precedence, extended to the week

The safety policy required every piece of free text to be screened, not just the
first one. Daily check-ins are now screened server-side. A check-in that trips
the screen:

- pauses delivery immediately and permanently (`paused_safety`)
- refuses all further check-ins
- sends one message: helplines, and nothing else
- **does not store the note** — it routes instead of being logged
- shows crisis resources in the app, with nothing sold anywhere on the screen

The person keeps their access. The week is theirs and they paid for it. Nothing
is pushed at them again.

## What is deliberately still missing

- **Refunds.** A safety pause stops delivery but does not refund. That needs a
  policy decision before real money is involved, not a code change.
- **A real datastore.** `FileEnrollmentRepository` is one atomically-written
  JSON file with serialised writes. It is honest for proving the loop and will
  not survive concurrent instances. `EnrollmentRepository` is the seam.
- **Email deliverability.** Nothing here handles SPF/DKIM, bounces, or
  unsubscribe headers. Required before mailing strangers.
- **Rate limiting** on `/api/enroll` and `/api/checkin`.
- **Data deletion.** There is no "forget me" endpoint yet. There needs to be.
