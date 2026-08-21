import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Enrollment, EnrollmentRepository } from './types';

/**
 * A file-backed enrolment store.
 *
 * One JSON document, written atomically (temp file + rename) so a crash
 * mid-write cannot truncate the data. Writes are serialised through a promise
 * chain because two Stripe webhook deliveries for the same enrolment arriving
 * together is a routine event, not an edge case.
 *
 * This is deliberately the smallest thing that satisfies "returns tomorrow
 * without losing context". It implements EnrollmentRepository, so swapping in
 * Postgres later is a new class, not a rewrite of the callers.
 */
export class FileEnrollmentRepository implements EnrollmentRepository {
  private readonly file: string;
  private readonly dir: string;
  private cache: Map<string, Enrollment> | null = null;
  /** Serialises all mutations. Every write appends to this chain. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.dir = dir;
    this.file = join(dir, 'enrollments.json');
  }

  private async load(): Promise<Map<string, Enrollment>> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.file, 'utf8');
      const rows = JSON.parse(raw) as Enrollment[];
      this.cache = new Map(rows.map((r) => [r.id, r]));
    } catch (err) {
      // A missing file is the normal first-run state. Anything else is real.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      this.cache = new Map();
    }
    return this.cache;
  }

  private async flush(rows: Enrollment[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(rows, null, 2), 'utf8');
    await rename(tmp, this.file);
  }

  /** Runs `fn` with exclusive access to the store. */
  private serialise<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    // Keep the chain alive even if this operation rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  async create(enrollment: Enrollment): Promise<Enrollment> {
    return this.serialise(async () => {
      const rows = await this.load();
      if (rows.has(enrollment.id)) throw new Error(`enrollment ${enrollment.id} already exists`);
      rows.set(enrollment.id, enrollment);
      await this.flush([...rows.values()]);
      return enrollment;
    });
  }

  async get(id: string): Promise<Enrollment | null> {
    const rows = await this.load();
    return rows.get(id) ?? null;
  }

  async findByResumeTokenHash(hash: string): Promise<Enrollment | null> {
    const rows = await this.load();
    for (const row of rows.values()) if (row.resumeTokenHash === hash) return row;
    return null;
  }

  async findByCheckoutId(checkoutId: string): Promise<Enrollment | null> {
    const rows = await this.load();
    for (const row of rows.values()) if (row.payment.checkoutId === checkoutId) return row;
    return null;
  }

  async update(id: string, mutate: (e: Enrollment) => Enrollment): Promise<Enrollment> {
    return this.serialise(async () => {
      const rows = await this.load();
      const current = rows.get(id);
      if (!current) throw new Error(`enrollment ${id} not found`);
      // Mutate a copy so a throwing mutator cannot leave the cache half-changed.
      const next = mutate(structuredClone(current));
      rows.set(id, next);
      await this.flush([...rows.values()]);
      return next;
    });
  }

  async active(): Promise<Enrollment[]> {
    const rows = await this.load();
    return [...rows.values()].filter((r) => r.status === 'active');
  }
}

/** In-memory repository for tests. Same semantics, no disk. */
export class MemoryEnrollmentRepository implements EnrollmentRepository {
  private rows = new Map<string, Enrollment>();

  async create(enrollment: Enrollment) {
    if (this.rows.has(enrollment.id)) throw new Error(`enrollment ${enrollment.id} already exists`);
    this.rows.set(enrollment.id, enrollment);
    return enrollment;
  }
  async get(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByResumeTokenHash(hash: string) {
    return [...this.rows.values()].find((r) => r.resumeTokenHash === hash) ?? null;
  }
  async findByCheckoutId(checkoutId: string) {
    return [...this.rows.values()].find((r) => r.payment.checkoutId === checkoutId) ?? null;
  }
  async update(id: string, mutate: (e: Enrollment) => Enrollment) {
    const current = this.rows.get(id);
    if (!current) throw new Error(`enrollment ${id} not found`);
    const next = mutate(structuredClone(current));
    this.rows.set(id, next);
    return next;
  }
  async active() {
    return [...this.rows.values()].filter((r) => r.status === 'active');
  }
}
