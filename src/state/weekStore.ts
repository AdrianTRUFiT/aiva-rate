import { create } from 'zustand';
import * as api from '../services/api';
import type { ResumeView, TodayView } from '../services/api';

/**
 * The server-backed half of the product: a paid week in progress.
 *
 * Kept separate from the anonymous session store on purpose. That one holds
 * an in-browser journey that has never been transmitted; this one holds
 * something a person paid for and expects to find again tomorrow.
 */

type Phase = 'loading' | 'none' | 'active';

interface WeekStore {
  phase: Phase;
  view: ResumeView | null;
  today: TodayView | null;
  error: string | null;
  /** Set when a check-in routed the person to support. */
  routedToSupport: boolean;

  /** Called once on boot; also handles a `?token=` resume link from email. */
  hydrate: () => Promise<void>;
  refreshToday: () => Promise<void>;
  checkIn: (day: number, rating: number | null, note: string) => Promise<void>;
  dismiss: () => void;
}

export const useWeek = create<WeekStore>((set, get) => ({
  phase: 'loading',
  view: null,
  today: null,
  error: null,
  routedToSupport: false,

  hydrate: async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') ?? undefined;

    try {
      const view = await api.loadSession(token);
      if (!view) return set({ phase: 'none', view: null });

      // Strip the one-time token from the address bar; the cookie holds it now.
      if (token || params.has('resume') || params.has('enrolled')) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      set({ phase: 'active', view });
      if (view.status === 'active') await get().refreshToday();
    } catch (err) {
      set({ phase: 'none', error: (err as Error).message });
    }
  },

  refreshToday: async () => {
    try {
      set({ today: await api.loadToday() });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  checkIn: async (day, rating, note) => {
    try {
      const result = await api.submitCheckin({ day, rating, note });
      set({ view: result.view, routedToSupport: Boolean(result.routedToSupport) });
      if (!result.routedToSupport) await get().refreshToday();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  dismiss: () => set({ phase: 'none', view: null, today: null, routedToSupport: false }),
}));

/**
 * A payment was just confirmed if we came back from checkout. The webhook is
 * what actually activates the week, and it can land a moment after the
 * browser redirect, so the caller polls briefly rather than assuming.
 */
export async function awaitActivation(attempts = 8, delayMs = 750): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const view = await api.loadSession();
    if (view && view.status !== 'pending_payment') {
      useWeek.setState({ phase: 'active', view });
      await useWeek.getState().refreshToday();
      return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}
