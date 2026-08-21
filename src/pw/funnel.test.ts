import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, evaluateOffer, MAX_ATTEMPTS, stageAfterCheckpoint, STAGE_ORDER } from './funnel';
import { interventionForPersona } from './interventions';
import type { SessionState } from './types';

/**
 * The offer gate is the single most important function in this codebase. If it
 * regresses, the system sells to people it did not help — which is the exact
 * behaviour the whole architecture exists to prevent.
 */

const session = (over: Partial<SessionState> = {}): SessionState => ({
  id: 'test',
  startedAt: new Date().toISOString(),
  stage: 'TRANSFORMATION',
  outcome: 'IN_PROGRESS',
  statement: 'I just got laid off',
  pressure: 'sudden-shock',
  persona: 'stabilizer',
  intervention: interventionForPersona('stabilizer') ?? null,
  interventionCompleted: true,
  shift: 'shifted',
  attempts: 1,
  events: [],
  safetyRouted: false,
  ...over,
});

test('allows the offer only after a completed exercise produced a reported shift', () => {
  const decision = evaluateOffer(session());
  assert.equal(decision.allowed, true);
  assert.equal(decision.alternative, null);
});

test('never offers to a session routed to support', () => {
  // Deliberately set up so every other condition would pass.
  const decision = evaluateOffer(session({ safetyRouted: true }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.alternative, 'support-resources');
});

test('never offers before an exercise has been completed', () => {
  const decision = evaluateOffer(session({ interventionCompleted: false }));
  assert.equal(decision.allowed, false);
});

test('never offers when the checkpoint has not been answered', () => {
  assert.equal(evaluateOffer(session({ shift: null })).allowed, false);
});

test('never offers to someone who reported feeling worse', () => {
  const decision = evaluateOffer(session({ shift: 'worse' }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.alternative, 'support-resources');
});

test('offers another exercise, not a purchase, when nothing shifted', () => {
  const decision = evaluateOffer(session({ shift: 'unchanged', attempts: 1 }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.alternative, 'another-intervention');
});

test('closes without pressure once the attempts are exhausted', () => {
  const decision = evaluateOffer(session({ shift: 'unchanged', attempts: MAX_ATTEMPTS }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.alternative, 'no-pressure-close');
});

test('the only route to an allowed offer is shift === "shifted"', () => {
  for (const shift of ['unchanged', 'worse', null] as const) {
    assert.equal(evaluateOffer(session({ shift })).allowed, false, `shift=${shift}`);
  }
});

test('a checkpoint loops back to another exercise while attempts remain', () => {
  assert.equal(stageAfterCheckpoint('unchanged', 1), 'ACTION');
  assert.equal(stageAfterCheckpoint('unchanged', MAX_ATTEMPTS), 'TRANSFORMATION');
  assert.equal(stageAfterCheckpoint('shifted', 1), 'TRANSFORMATION');
  assert.equal(stageAfterCheckpoint('worse', 1), 'TRANSFORMATION');
});

test('the stage machine does not permit skipping the action stage', () => {
  assert.equal(canTransition('EDUCATION', 'OFFER'), false);
  assert.equal(canTransition('THRESHOLD', 'OFFER'), false);
  assert.equal(canTransition('CHECKPOINT', 'OFFER'), false);
  assert.equal(canTransition('TRANSFORMATION', 'OFFER'), true);
});

test('every stage in the order has a transition rule', () => {
  for (const stage of STAGE_ORDER) {
    assert.doesNotThrow(() => canTransition(stage, 'OFFER'));
  }
});
