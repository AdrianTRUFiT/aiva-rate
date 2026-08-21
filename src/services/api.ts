import type { CheckinRequest, EnrollRequest, EnrollResponse, ResumeView } from '../../server/api';
import type { InterventionStep } from '../pw/types';

/**
 * Browser-side API client.
 *
 * Nothing here is called before a person accepts the offer — the journey up to
 * that point stays entirely in the browser, which is what the threshold screen
 * promises. `enroll` is the first request this app ever makes.
 */

export interface TodayView {
  day: number;
  name: string;
  premise: string;
  steps: InterventionStep[];
  checkIn: string;
  checkpointQuestion: string;
  alreadyLogged: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly gate?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    // The resume cookie is httpOnly, so it has to ride along explicitly.
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; gate?: string };
    throw new ApiError(body.error ?? `request failed (${res.status})`, res.status, body.gate);
  }
  return res.json() as Promise<T>;
}

export const enroll = (body: EnrollRequest) =>
  request<EnrollResponse>('/enroll', { method: 'POST', body: JSON.stringify(body) });

/** Returns null when there is no week to resume, which is the common case. */
export async function loadSession(token?: string): Promise<ResumeView | null> {
  try {
    return await request<ResumeView>(`/session${token ? `?token=${encodeURIComponent(token)}` : ''}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export const loadToday = () => request<TodayView>('/today');

export const submitCheckin = (body: CheckinRequest) =>
  request<{ ok: true; view: ResumeView; routedToSupport?: boolean }>('/checkin', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export type { ResumeView, EnrollRequest };
