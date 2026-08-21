import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect, newWindow, spend } from './budget';
import type { DeskLimits } from './types';

/**
 * The rule this file exists to protect: a desk spends its own limit and
 * nothing else. Rotating across accounts to get more throughput than any one
 * of them was granted is precisely the behaviour that must not exist.
 */

const limits: DeskLimits = { requestsPerWindow: 100, windowSeconds: 60 };
const T0 = new Date('2026-03-01T09:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

test('a desk can spend up to its own limit and no further', () => {
  let window = newWindow('stabilizer', T0);
  const first = spend(window, limits, 60, T0);
  assert.equal(first.grant.granted, 60);
  assert.equal(first.grant.remaining, 40);

  const second = spend(first.window, limits, 60, T0);
  assert.equal(second.grant.granted, 40, 'only what is left may be granted');
  assert.equal(second.grant.exhausted, true);
});

test('an exhausted desk is granted zero — it does not borrow', () => {
  let window = newWindow('regulator', T0);
  window = spend(window, limits, 100, T0).window;

  const denied = spend(window, limits, 50, T0);
  assert.equal(denied.grant.granted, 0);
  assert.equal(denied.grant.exhausted, true);
  assert.equal(denied.grant.resetsAt, at(60).toISOString());
});

test('spending one desk leaves every other desk untouched', () => {
  // Budgets are per-desk objects with no shared pool, so exhausting one desk
  // cannot affect another. This asserts the structural property directly.
  let spent = newWindow('stabilizer', T0);
  spent = spend(spent, limits, 100, T0).window;
  assert.equal(inspect(spent, limits, T0).remaining, 0);

  const other = newWindow('architect', T0);
  assert.equal(inspect(other, limits, T0).remaining, 100);
  assert.equal(spend(other, limits, 100, T0).grant.granted, 100);
});

test('the window rolls forward and the desk recovers its own limit', () => {
  let window = newWindow('unraveler', T0);
  window = spend(window, limits, 100, T0).window;
  assert.equal(inspect(window, limits, at(30)).exhausted, true);

  const afterReset = spend(window, limits, 40, at(61));
  assert.equal(afterReset.grant.granted, 40);
  assert.equal(afterReset.grant.remaining, 60);
});

test('inspect reports state without consuming budget', () => {
  const window = spend(newWindow('navigator', T0), limits, 30, T0).window;
  assert.equal(inspect(window, limits, T0).remaining, 70);
  assert.equal(inspect(window, limits, T0).remaining, 70, 'inspect must be side-effect free');
});

test('desks with different assigned limits keep them', () => {
  const small: DeskLimits = { requestsPerWindow: 10, windowSeconds: 600 };
  const grant = spend(newWindow('companion', T0), small, 100, T0).grant;
  assert.equal(grant.granted, 10, 'a desk never exceeds the limit it was assigned');
  assert.equal(grant.resetsAt, new Date(T0.getTime() + 600_000).toISOString());
});

test('spend takes exactly one desk and has no fallback parameter', () => {
  // A structural assertion: the signature cannot express "try another desk".
  assert.equal(spend.length, 4, 'window, limits, requested, now — no desk list');
});
