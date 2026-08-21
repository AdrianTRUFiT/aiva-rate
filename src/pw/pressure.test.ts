import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, LOW_CONFIDENCE, PRESSURE_MOMENTS, PRESSURE_ORDER } from './pressure';
import { PERSONAS } from './personas';
import type { PressureId } from './types';

/** The statements the doctrine names, each mapped to the door it should open. */
const CASES: [string, PressureId][] = [
  ['I just got laid off and I am freaking out', 'sudden-shock'],
  ['I got the news today and I am in shock', 'sudden-shock'],
  ['everything is happening at once and I am drowning', 'overwhelm'],
  ['I am so overwhelmed I do not know where to start', 'overwhelm'],
  ['I feel completely alone in this, no one to talk to', 'isolation'],
  ['we are getting a divorce and I do not know who I am anymore', 'identity-disruption'],
  ['I cannot decide whether to accept the offer', 'decision-paralysis'],
  ['I am burned out and I have no energy left', 'burnout'],
  ['I am starting college next week', 'new-beginning'],
  ["I can't shut my mind off at 3am", 'racing-thoughts'],
  ['I feel like an imposter and I am not good enough', 'self-doubt'],
  ['day 4 and I think I am staying on track', 'continuation'],
];

test('routes canonical pressure statements to the right front door', () => {
  for (const [statement, expected] of CASES) {
    const result = classify(statement);
    assert.equal(result.pressure, expected, `"${statement}" → ${result.pressure}`);
  }
});

test('a confident classification clears the confirmation threshold', () => {
  const result = classify('I just got laid off, I am panicking');
  assert.ok(result.confidence >= LOW_CONFIDENCE, `confidence was ${result.confidence}`);
});

test('an unrecognised statement falls back without pretending to be sure', () => {
  const result = classify('the weather has been quite mild for october');
  assert.equal(result.confidence, 0);
  assert.equal(result.matched.length, 0);
});

test('cues match on word boundaries', () => {
  // "alone" must not fire on "along"; "fired" must not fire on "firedrill".
  assert.equal(classify('we walked along the river').confidence, 0);
  assert.equal(classify('we ran a firedrill today').confidence, 0);
});

test('every pressure moment has an owning persona that points back at it', () => {
  for (const id of PRESSURE_ORDER) {
    const moment = PRESSURE_MOMENTS[id];
    assert.equal(PERSONAS[moment.owner].pressure, id, `${moment.owner} should own ${id}`);
  }
});

test('classification is stable across casing and punctuation', () => {
  assert.equal(classify('I JUST GOT LAID OFF!!!').pressure, 'sudden-shock');
});
