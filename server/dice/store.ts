import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BudgetWindow } from './budget';
import type { DeskId, Signal } from './types';

/**
 * DICE persistence.
 *
 * Signals and budget windows, keyed by desk. Same shape as the enrolment store:
 * a repository interface with an atomic file implementation and an in-memory
 * one for tests, so moving to a real database is a new class rather than a
 * rewrite of the callers.
 */

export interface DiceState {
  signals: Record<string, Signal>;
  budgets: Partial<Record<DeskId, BudgetWindow>>;
  lastDiscovery: Partial<Record<DeskId, string>>;
}

export interface DiceRepository {
  all(): Promise<Signal[]>;
  forDesk(deskId: DeskId): Promise<Signal[]>;
  get(id: string): Promise<Signal | null>;
  upsertMany(signals: Signal[]): Promise<void>;
  update(id: string, mutate: (s: Signal) => Signal): Promise<Signal>;
  budget(deskId: DeskId): Promise<BudgetWindow | null>;
  saveBudget(window: BudgetWindow): Promise<void>;
  lastDiscovery(deskId: DeskId): Promise<string | null>;
  markDiscovery(deskId: DeskId, at: string): Promise<void>;
}

const empty = (): DiceState => ({ signals: {}, budgets: {}, lastDiscovery: {} });

export class MemoryDiceRepository implements DiceRepository {
  protected state: DiceState = empty();

  async all() {
    return Object.values(this.state.signals);
  }
  async forDesk(deskId: DeskId) {
    return Object.values(this.state.signals).filter((s) => s.deskId === deskId);
  }
  async get(id: string) {
    return this.state.signals[id] ?? null;
  }
  async upsertMany(signals: Signal[]) {
    for (const signal of signals) {
      // Never clobber a signal an operator has already worked: discovery
      // re-finding a post must not reset it to 'new'.
      const existing = this.state.signals[signal.id];
      if (existing && existing.history.length > 1) continue;
      this.state.signals[signal.id] = signal;
    }
    await this.persist();
  }
  async update(id: string, mutate: (s: Signal) => Signal) {
    const current = this.state.signals[id];
    if (!current) throw new Error(`signal ${id} not found`);
    const next = mutate(structuredClone(current));
    this.state.signals[id] = next;
    await this.persist();
    return next;
  }
  async budget(deskId: DeskId) {
    return this.state.budgets[deskId] ?? null;
  }
  async saveBudget(window: BudgetWindow) {
    this.state.budgets[window.deskId] = window;
    await this.persist();
  }
  async lastDiscovery(deskId: DeskId) {
    return this.state.lastDiscovery[deskId] ?? null;
  }
  async markDiscovery(deskId: DeskId, at: string) {
    this.state.lastDiscovery[deskId] = at;
    await this.persist();
  }

  protected async persist(): Promise<void> {
    // In-memory: nothing to do.
  }
}

export class FileDiceRepository extends MemoryDiceRepository {
  private readonly file: string;
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dir: string) {
    super();
    this.file = join(dir, 'dice.json');
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      this.state = JSON.parse(await readFile(this.file, 'utf8')) as DiceState;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      this.state = empty();
    }
    this.loaded = true;
  }

  protected async persist(): Promise<void> {
    const write = this.queue.then(async () => {
      await mkdir(this.dir, { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      await rename(tmp, this.file);
    });
    this.queue = write.catch(() => undefined);
    return write;
  }

  async all() { await this.load(); return super.all(); }
  async forDesk(deskId: DeskId) { await this.load(); return super.forDesk(deskId); }
  async get(id: string) { await this.load(); return super.get(id); }
  async upsertMany(signals: Signal[]) { await this.load(); return super.upsertMany(signals); }
  async update(id: string, mutate: (s: Signal) => Signal) { await this.load(); return super.update(id, mutate); }
  async budget(deskId: DeskId) { await this.load(); return super.budget(deskId); }
  async saveBudget(window: BudgetWindow) { await this.load(); return super.saveBudget(window); }
  async lastDiscovery(deskId: DeskId) { await this.load(); return super.lastDiscovery(deskId); }
  async markDiscovery(deskId: DeskId, at: string) { await this.load(); return super.markDiscovery(deskId, at); }
}
