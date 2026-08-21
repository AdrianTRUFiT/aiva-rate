import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileEnrollmentRepository } from './fileStore';
import type { Enrollment } from './types';

/**
 * Durability is the whole point of this file: "returns tomorrow without losing
 * context" means surviving a process restart, not just a page reload.
 */

let dir: string;
const dirs: string[] = [];

const enrollment = (id: string): Enrollment => ({
  id,
  createdAt: new Date().toISOString(),
  pressure: 'burnout',
  entryPersona: 'regulator',
  entryIntervention: 'downshift-3',
  email: `${id}@example.com`,
  status: 'pending_payment',
  payment: { provider: 'mock', checkoutId: `cs_${id}`, paidAt: null, amountCents: 2900, currency: 'usd' },
  startedAt: null,
  days: [],
  deliveries: [],
  resumeTokenHash: `hash_${id}`,
  safety: null,
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pw-store-'));
  dirs.push(dir);
});

after(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

test('an enrolment survives a fresh repository instance', async () => {
  const first = new FileEnrollmentRepository(dir);
  await first.create(enrollment('enr_a'));
  await first.update('enr_a', (e) => ({ ...e, status: 'active', startedAt: '2026-03-01T00:00:00.000Z' }));

  // A completely separate instance, as after a restart.
  const second = new FileEnrollmentRepository(dir);
  const loaded = await second.get('enr_a');
  assert.equal(loaded?.status, 'active');
  assert.equal(loaded?.startedAt, '2026-03-01T00:00:00.000Z');
  assert.equal(loaded?.pressure, 'burnout');
});

test('lookups by resume hash and checkout id survive a restart', async () => {
  await new FileEnrollmentRepository(dir).create(enrollment('enr_b'));
  const fresh = new FileEnrollmentRepository(dir);
  assert.equal((await fresh.findByResumeTokenHash('hash_enr_b'))?.id, 'enr_b');
  assert.equal((await fresh.findByCheckoutId('cs_enr_b'))?.id, 'enr_b');
  assert.equal(await fresh.findByResumeTokenHash('nope'), null);
});

test('concurrent updates all land — none is lost to a read-modify-write race', async () => {
  const repo = new FileEnrollmentRepository(dir);
  await repo.create(enrollment('enr_c'));

  // Seven deliveries recorded at once, as a sweep would.
  await Promise.all(
    Array.from({ length: 7 }, (_, i) =>
      repo.update('enr_c', (e) => ({
        ...e,
        deliveries: [...e.deliveries, { day: i + 1, sentAt: 'now', channel: 'email', messageId: `m${i}` }],
      })),
    ),
  );

  const days = (await repo.get('enr_c'))!.deliveries.map((d) => d.day).sort((a, b) => a - b);
  assert.deepEqual(days, [1, 2, 3, 4, 5, 6, 7]);
  // And it is on disk, not only in the cache.
  const onDisk = JSON.parse(await readFile(join(dir, 'enrollments.json'), 'utf8')) as Enrollment[];
  assert.equal(onDisk[0].deliveries.length, 7);
});

test('a duplicate id is refused rather than overwriting someone', async () => {
  const repo = new FileEnrollmentRepository(dir);
  await repo.create(enrollment('enr_d'));
  await assert.rejects(() => repo.create(enrollment('enr_d')), /already exists/);
});

test('updating a missing enrolment rejects and does not create one', async () => {
  const repo = new FileEnrollmentRepository(dir);
  await assert.rejects(() => repo.update('enr_missing', (e) => e), /not found/);
  assert.equal(await repo.get('enr_missing'), null);
});

test('a throwing mutator leaves the stored record untouched', async () => {
  const repo = new FileEnrollmentRepository(dir);
  await repo.create(enrollment('enr_e'));
  await assert.rejects(() =>
    repo.update('enr_e', () => {
      throw new Error('mutator blew up');
    }),
  );
  assert.equal((await repo.get('enr_e'))?.status, 'pending_payment');
  // The write queue keeps working after a rejection.
  await repo.update('enr_e', (e) => ({ ...e, status: 'active' }));
  assert.equal((await repo.get('enr_e'))?.status, 'active');
});

test('active() returns only active enrolments', async () => {
  const repo = new FileEnrollmentRepository(dir);
  await repo.create({ ...enrollment('enr_f'), status: 'active' });
  await repo.create({ ...enrollment('enr_g'), status: 'paused_safety' });
  await repo.create(enrollment('enr_h'));
  assert.deepEqual((await repo.active()).map((e) => e.id), ['enr_f']);
});

test('a first run with no file behaves as an empty store', async () => {
  const repo = new FileEnrollmentRepository(join(dir, 'does-not-exist-yet'));
  assert.deepEqual(await repo.active(), []);
  assert.equal(await repo.get('anything'), null);
});
