import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotate, buildIndex, checkCollision, emptyIndex } from './collision';
import type { Signal, SignalState } from './types';

/**
 * The one thing the ten desks share, and the reason they share it: two desks
 * unknowingly working the same person is what would make ten legitimate desks
 * look coordinated from the outside.
 */

const signal = (over: Partial<Signal> = {}): Signal => ({
  id: 'stabilizer:jobs:p1',
  deskId: 'stabilizer',
  source: 'fixture',
  subreddit: 'jobs',
  postId: 'p1',
  author: 'throwaway_march12',
  title: 'Got laid off',
  excerpt: 'no warning',
  permalink: 'https://reddit.com/r/jobs/comments/p1',
  createdAt: '2026-03-01T08:00:00.000Z',
  discoveredAt: '2026-03-01T09:00:00.000Z',
  scores: { fit: 80, intent: 70, freshnessHours: 1, priority: 75 },
  reasons: [],
  capture: 'source',
  ageUnknown: false,
  state: 'new',
  screenedReason: null,
  actions: { reply: { allowed: true, reason: '' }, message: { allowed: false, reason: '' } },
  collision: null,
  history: [{ at: '2026-03-01T09:00:00.000Z', event: 'discovered' }],
  ...over,
});

test('a merely-discovered signal is not a collision', () => {
  // Two desks may legitimately find the same post. Blocking on that would make
  // every queue useless.
  const index = buildIndex([signal({ deskId: 'regulator', state: 'new' })]);
  assert.equal(checkCollision(index, 'stabilizer', 'throwaway_march12', 'jobs', 'p1'), null);
});

test('an engaged signal collides for every other desk', () => {
  for (const state of ['activated', 'replied', 'follow-up', 'qualified', 'closed'] as SignalState[]) {
    const index = buildIndex([signal({ deskId: 'regulator', state })]);
    const hit = checkCollision(index, 'stabilizer', 'throwaway_march12', 'jobs', 'p1');
    assert.ok(hit, `${state} should collide`);
    assert.equal(hit.deskId, 'regulator');
  }
});

test('a desk does not collide with itself', () => {
  const index = buildIndex([signal({ deskId: 'stabilizer', state: 'replied' })]);
  assert.equal(checkCollision(index, 'stabilizer', 'throwaway_march12', 'jobs', 'p1'), null);
});

test('the same person in a different thread still collides', () => {
  const index = buildIndex([signal({ deskId: 'companion', state: 'replied' })]);
  const hit = checkCollision(index, 'stabilizer', 'throwaway_march12', 'careerguidance', 'other');
  assert.ok(hit);
  assert.equal(hit.on, 'author');
});

test('the same thread from a different author still collides', () => {
  const index = buildIndex([signal({ deskId: 'navigator', state: 'activated' })]);
  const hit = checkCollision(index, 'stabilizer', 'someone_else', 'jobs', 'p1');
  assert.ok(hit);
  assert.equal(hit.on, 'thread');
});

test('thread collisions take precedence over author collisions', () => {
  const index = buildIndex([
    signal({ deskId: 'navigator', state: 'activated', author: 'a', postId: 'p1' }),
    signal({ id: 'x', deskId: 'companion', state: 'replied', author: 'b', postId: 'p9' }),
  ]);
  assert.equal(checkCollision(index, 'stabilizer', 'b', 'jobs', 'p1')?.on, 'thread');
});

test('author matching is case-insensitive', () => {
  const index = buildIndex([signal({ deskId: 'regulator', state: 'replied', author: 'Quiet_User' })]);
  assert.ok(checkCollision(index, 'stabilizer', 'quiet_user', 'other', 'zzz'));
});

test('annotate marks a queue that became un-actionable after another desk acted', () => {
  const mine = signal({ deskId: 'stabilizer', state: 'new' });
  const theirs = signal({ id: 'other', deskId: 'regulator', state: 'replied' });

  const before = annotate([mine], emptyIndex());
  assert.equal(before[0].collision, null);

  const after = annotate([mine], buildIndex([theirs]));
  assert.equal(after[0].collision?.deskId, 'regulator');
});

test('an empty index collides with nothing', () => {
  assert.equal(checkCollision(emptyIndex(), 'stabilizer', 'anyone', 'jobs', 'p1'), null);
});
