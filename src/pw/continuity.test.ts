import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResetPlan } from './continuity';
import { PRESSURE_ORDER, getPressure } from './pressure';
import { INTERVENTIONS } from './interventions';
import { PERSONA_ORDER } from './personas';

test('every pressure moment produces a full seven-day plan', () => {
  for (const pressure of PRESSURE_ORDER) {
    assert.equal(buildResetPlan(pressure).length, 7, `${pressure} plan was short`);
  }
});

test('a plan never repeats a guide or an exercise', () => {
  for (const pressure of PRESSURE_ORDER) {
    const plan = buildResetPlan(pressure);
    assert.equal(new Set(plan.map((d) => d.persona)).size, 7, `${pressure} repeated a guide`);
    assert.equal(new Set(plan.map((d) => d.intervention.id)).size, 7, `${pressure} repeated an exercise`);
  }
});

test('day one belongs to the door the person actually came through', () => {
  for (const pressure of PRESSURE_ORDER) {
    const owner = getPressure(pressure).owner;
    const plan = buildResetPlan(pressure);
    // The one exception: someone whose door is already continuation gets that
    // guide on day 7 where it belongs, and their top supporting guide on day 1.
    const expected = owner === 'continuity-guide' ? getPressure(pressure).support[0] : owner;
    assert.equal(plan[0].persona, expected, `${pressure} day 1`);
  }
});

test('the week always ends with the continuity guide', () => {
  for (const pressure of PRESSURE_ORDER) {
    assert.equal(buildResetPlan(pressure)[6].persona, 'continuity-guide', `${pressure} day 7`);
  }
});

test('days are numbered 1..7 in order', () => {
  assert.deepEqual(
    buildResetPlan('burnout').map((d) => d.day),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

test('every guide has exactly one intervention, and every intervention a real duration', () => {
  assert.equal(INTERVENTIONS.length, PERSONA_ORDER.length);
  for (const i of INTERVENTIONS) {
    const summed = i.steps.reduce((s, step) => s + step.seconds, 0);
    assert.equal(i.durationSeconds, summed, `${i.id} duration drifted from its steps`);
    assert.ok(i.steps.length >= 3, `${i.id} is too thin to be guided`);
    assert.ok(i.durationSeconds <= 240, `${i.id} is no longer a micro-intervention`);
    assert.ok(i.checkpointQuestion.endsWith('?'), `${i.id} checkpoint is not a question`);
  }
});
