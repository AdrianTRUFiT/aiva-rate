import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useSession } from './sessionStore';
import { MAX_ATTEMPTS } from '../pw/funnel';

/**
 * End-to-end journeys through the store. These assert the behaviour a user
 * actually experiences, rather than the behaviour of any one pure function.
 */

// The store signs artifacts with btoa, which is global in the browser but only
// arrived in Node under the same name — assert it rather than assume it.
assert.equal(typeof btoa, 'function', 'btoa must exist for the ledger to sign events');

const store = () => useSession.getState();

beforeEach(() => store().reset());

test('a person who is helped is offered the week', () => {
  store().submitStatement('I just got laid off and I am freaking out');
  assert.equal(store().session.stage, 'REFLECTION');
  assert.equal(store().session.pressure, 'sudden-shock');
  assert.equal(store().session.persona, 'stabilizer');

  store().advance('EDUCATION');
  store().advance('ACTION');
  store().completeIntervention();
  assert.equal(store().session.stage, 'CHECKPOINT');

  store().reportShift('shifted');
  assert.equal(store().session.stage, 'TRANSFORMATION');
  assert.equal(store().offerDecision().allowed, true);

  store().advance('OFFER');
  store().acceptOffer();
  assert.equal(store().session.stage, 'CONTINUATION');
  assert.equal(store().session.outcome, 'COMPLETED_WITH_OFFER');
});

test('a crisis statement halts the funnel and can never reach an offer', () => {
  store().submitStatement('I have been thinking about killing myself');

  assert.equal(store().session.safetyRouted, true);
  assert.equal(store().session.outcome, 'ROUTED_TO_SUPPORT');
  assert.equal(store().session.stage, 'THRESHOLD', 'must not advance into the funnel');
  assert.equal(store().session.intervention, null, 'must not bind an exercise');
  assert.equal(store().offerDecision().allowed, false);
  assert.equal(store().safety?.level, 'route');
});

test('"nothing changed" binds a different exercise instead of repeating one', () => {
  store().submitStatement('I am completely burned out');
  const first = store().session.intervention?.id;

  store().advance('EDUCATION');
  store().advance('ACTION');
  store().completeIntervention();
  store().reportShift('unchanged');

  assert.equal(store().session.stage, 'ACTION');
  assert.notEqual(store().session.intervention?.id, first, 'should not re-serve the same exercise');
  assert.equal(store().session.interventionCompleted, false);
  assert.equal(store().session.shift, null);
  assert.equal(store().offerDecision().allowed, false);
});

test('after the attempt limit the session closes without an offer', () => {
  store().submitStatement('everything is happening at once and I am drowning');
  store().advance('EDUCATION');

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    store().advance('ACTION');
    store().completeIntervention();
    store().reportShift('unchanged');
  }

  assert.equal(store().session.attempts, MAX_ATTEMPTS);
  assert.equal(store().session.stage, 'TRANSFORMATION');
  const decision = store().offerDecision();
  assert.equal(decision.allowed, false);
  assert.equal(decision.alternative, 'no-pressure-close');
});

test('feeling worse never produces an offer', () => {
  store().submitStatement("I can't shut my mind off at night");
  store().advance('EDUCATION');
  store().advance('ACTION');
  store().completeIntervention();
  store().reportShift('worse');

  const decision = store().offerDecision();
  assert.equal(decision.allowed, false);
  assert.equal(decision.alternative, 'support-resources');
  // The session is over at that point; it must not sit open as IN_PROGRESS.
  assert.equal(store().session.outcome, 'COMPLETED_NO_OFFER');
});

test('a person can correct the door the classifier chose', () => {
  store().submitStatement('I am not sure what is going on with me lately');
  store().correctPressure('decision-paralysis');

  assert.equal(store().session.pressure, 'decision-paralysis');
  assert.equal(store().session.persona, 'navigator');
  assert.equal(store().session.intervention?.id, 'three-path-map');
});

test('every stage transition is recorded and signed', () => {
  store().submitStatement('I just got laid off');
  store().advance('EDUCATION');
  store().advance('ACTION');
  store().completeIntervention();
  store().reportShift('shifted');

  const events = store().session.events;
  assert.ok(events.length >= 5, `expected a trail, got ${events.length} events`);
  for (const e of events) {
    assert.match(String(e.detail.signature), /^sig_/, `${e.kind} was not signed`);
  }
  assert.deepEqual(
    events.map((e) => e.kind),
    ['SIGNAL_CLASSIFIED', 'STAGE_ENTERED', 'STAGE_ENTERED', 'INTERVENTION_COMPLETED', 'SHIFT_REPORTED'],
  );
});

test('an accepted offer records which guide and exercise earned it', () => {
  store().submitStatement('I am starting college next week and I am nervous');
  store().advance('EDUCATION');
  store().advance('ACTION');
  store().completeIntervention();
  store().reportShift('shifted');
  store().advance('OFFER');
  store().acceptOffer();

  const accepted = store().session.events.find((e) => e.kind === 'OFFER_ACCEPTED');
  assert.ok(accepted, 'no attribution event was written');
  assert.equal(accepted.detail.attributedPersona, 'architect');
  assert.equal(accepted.detail.attributedIntervention, 'starter-blueprint');
});

test('reset clears the session, the safety signal, and the tried list', () => {
  store().submitStatement('I want to kill myself');
  store().reset();

  assert.equal(store().session.safetyRouted, false);
  assert.equal(store().safety, null);
  assert.equal(store().session.stage, 'THRESHOLD');
  assert.equal(store().session.events.length, 0);
  assert.deepEqual(store().tried, []);
});
