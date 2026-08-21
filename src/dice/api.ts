import type { Recommendation } from '../../server/dice/aiop';
import type { Desk, DeskSummary, Signal, SignalState } from '../../server/dice/types';

/** Browser client for the operator console. Every call requires a session. */

export interface DesksResponse {
  desks: DeskSummary[];
  source: string;
  simulated: boolean;
  totals: { signals: number; priority: number; active: number; screenedOut: number };
}

export interface DeskView {
  desk: Desk;
  scope: { searchable: string[]; refused: { name: string; reason?: string }[] };
  budget: { used: number; limit: number; resetsAt: string; exhausted: boolean };
  counts: DeskSummary['counts'];
  queue: Record<SignalState, number>;
  states: SignalState[];
  signals: (Signal & { aiop: Recommendation })[];
  lastDiscoveryAt: string | null;
}

export class DiceError extends Error {
  constructor(message: string, readonly status: number, readonly extra?: Record<string, unknown>) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/dice${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new DiceError((body as { error?: string }).error ?? `failed (${res.status})`, res.status, body);
  return body as T;
}

export const login = (password: string) =>
  call<{ ok: true }>('/login', { method: 'POST', body: JSON.stringify({ password }) });

export const logout = () => call<{ ok: true }>('/logout', { method: 'POST' });

export const me = () => call<{ ok: true }>('/me');

export const loadDesks = () => call<DesksResponse>('/desks');

export const loadDesk = (deskId: string, state?: string) =>
  call<DeskView>(`/desks/${deskId}${state ? `?state=${encodeURIComponent(state)}` : ''}`);

export const discover = (deskId: string) =>
  call<{ counts: DeskSummary['counts']; spent: number; truncated: boolean; budget: { remaining: number; resetsAt: string } }>(
    `/desks/${deskId}/discover`,
    { method: 'POST' },
  );

export const setState = (signalId: string, state: SignalState, note?: string) =>
  call<{ signal: Signal }>(`/signals/${encodeURIComponent(signalId)}/state`, {
    method: 'POST',
    body: JSON.stringify({ state, note }),
  });

export const loadPolicy = () =>
  call<{ blocked: { name: string; reason?: string }[]; note: string }>('/policy');

export type { Desk, DeskSummary, Signal, SignalState, Recommendation };
