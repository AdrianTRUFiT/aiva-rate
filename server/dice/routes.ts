import express, { type Request, type Response, type Router } from 'express';
import { config } from '../config';
import { DESK_IDS, allDesks, buildDesk, isDeskId } from './accounts';
import { inspect, newWindow, spend } from './budget';
import { annotate, buildIndex } from './collision';
import { recommend } from './aiop';
import { runPipeline, resolveSearchScope } from './pipeline';
import { BLOCKED_SUBREDDITS } from './policy';
import { signalSource } from './sources';
import {
  clearOperatorCookie,
  issueSession,
  operatorCookie,
  passwordMatches,
  requireOperator,
  type OperatorAuth,
} from './auth';
import type { DiceRepository } from './store';
import type { Clock } from '../delivery';
import type { DeskSummary, Signal, SignalState } from './types';
import { OPERATOR_STATES } from './types';

export interface DiceDeps {
  repo: DiceRepository;
  auth: OperatorAuth;
  clock: Clock;
}

const bad = (res: Response, status: number, error: string) => res.status(status).json({ error });

/** Desks are simulated only while the fixture source is the one in use. */
const simulating = () => signalSource().name === 'fixture';
const secure = () => config.appUrl.startsWith('https://');

/** Counts a desk's queue by state, so the console can render its filters. */
function queueCounts(signals: Signal[]): Record<SignalState, number> {
  const counts = {} as Record<SignalState, number>;
  for (const signal of signals) counts[signal.state] = (counts[signal.state] ?? 0) + 1;
  return counts;
}

/** Recomputes a desk's funnel counts from what is actually stored. */
function countsFor(signals: Signal[]) {
  const screenedOut = signals.filter((s) => s.state === 'do-not-contact' || s.state === 'blocked').length;
  const rejected = signals.filter((s) => s.state === 'rejected').length;
  const relevant = signals.length - screenedOut - rejected;
  return {
    discovered: signals.length,
    afterDedup: signals.length,
    screenedOut,
    relevant,
    strong: signals.filter((s) => s.scores.priority >= 70 && s.state !== 'rejected').length,
    priorityToday: signals.filter((s) => s.state === 'priority').length,
  };
}

export function buildDiceRoutes(deps: DiceDeps): Router {
  const { repo, auth, clock } = deps;
  const router = express.Router();
  const guard = requireOperator(auth, clock);

  /* ------------------------------ sign-in ------------------------------ */

  router.post('/login', express.json({ limit: '2kb' }), (req: Request, res: Response) => {
    const { password } = (req.body ?? {}) as { password?: string };
    if (typeof password !== 'string' || !passwordMatches(password, auth)) {
      return bad(res, 401, 'incorrect password');
    }
    res.setHeader('Set-Cookie', operatorCookie(issueSession(auth, clock()), secure()));
    res.json({ ok: true });
  });

  router.post('/logout', (_req: Request, res: Response) => {
    res.setHeader('Set-Cookie', clearOperatorCookie());
    res.json({ ok: true });
  });

  router.get('/me', guard, (_req: Request, res: Response) => res.json({ ok: true }));

  /* ------------------------------ overview ----------------------------- */

  router.get('/desks', guard, async (_req: Request, res: Response) => {
    const all = await repo.all();
    const summaries: DeskSummary[] = [];

    for (const desk of allDesks(simulating())) {
      const signals = all.filter((s) => s.deskId === desk.id);
      const window = (await repo.budget(desk.id)) ?? newWindow(desk.id, clock());
      const grant = inspect(window, desk.limits, clock());

      summaries.push({
        desk,
        counts: countsFor(signals),
        queue: queueCounts(signals),
        budget: {
          used: desk.limits.requestsPerWindow - grant.remaining,
          limit: desk.limits.requestsPerWindow,
          resetsAt: grant.resetsAt,
          exhausted: grant.exhausted,
        },
        lastDiscoveryAt: await repo.lastDiscovery(desk.id),
      });
    }

    res.json({
      desks: summaries,
      source: signalSource().name,
      simulated: simulating(),
      totals: {
        signals: all.length,
        priority: all.filter((s) => s.state === 'priority').length,
        active: all.filter((s) => ['activated', 'replied', 'follow-up'].includes(s.state)).length,
        screenedOut: all.filter((s) => s.state === 'do-not-contact' || s.state === 'blocked').length,
      },
    });
  });

  /* ------------------------------- one desk ---------------------------- */

  router.get('/desks/:deskId', guard, async (req: Request, res: Response) => {
    const deskId = req.params.deskId;
    if (!isDeskId(deskId)) return bad(res, 404, 'no such desk');

    const desk = buildDesk(deskId, simulating());
    const index = buildIndex(await repo.all());
    const signals = annotate(await repo.forDesk(deskId), index);

    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const filtered = state ? signals.filter((s) => s.state === state) : signals;

    const scope = resolveSearchScope(desk);
    const window = (await repo.budget(deskId)) ?? newWindow(deskId, clock());
    const grant = inspect(window, desk.limits, clock());

    res.json({
      desk,
      scope: {
        searchable: scope.allowed,
        refused: scope.refused.map((r) => ({ name: r.name, reason: r.reason })),
      },
      budget: {
        used: desk.limits.requestsPerWindow - grant.remaining,
        limit: desk.limits.requestsPerWindow,
        resetsAt: grant.resetsAt,
        exhausted: grant.exhausted,
      },
      counts: countsFor(signals),
      queue: queueCounts(signals),
      states: OPERATOR_STATES,
      signals: filtered
        .sort((a, b) => b.scores.priority - a.scores.priority)
        .slice(0, 100)
        .map((signal) => ({ ...signal, aiop: recommend(desk, signal) })),
      lastDiscoveryAt: await repo.lastDiscovery(deskId),
    });
  });

  /* ------------------------------ discovery ---------------------------- */

  router.post('/desks/:deskId/discover', guard, async (req: Request, res: Response) => {
    const deskId = req.params.deskId;
    if (!isDeskId(deskId)) return bad(res, 404, 'no such desk');

    const desk = buildDesk(deskId, simulating());
    const now = clock();

    if (!desk.grants.read) {
      return bad(res, 403, `${desk.handle} has no read grant. Nothing can be discovered.`);
    }

    const scope = resolveSearchScope(desk);
    if (scope.allowed.length === 0) {
      return bad(res, 400, 'every configured subreddit for this desk is blocked by policy');
    }

    // Spend this desk's own budget. If it is exhausted the run defers — it does
    // not continue on another desk's allowance. See budget.ts.
    const stored = (await repo.budget(deskId)) ?? newWindow(deskId, now);
    const { window, grant } = spend(stored, desk.limits, desk.limits.requestsPerWindow, now);
    await repo.saveBudget(window);

    if (grant.granted === 0) {
      return res.status(429).json({
        error: `${desk.handle} has reached its rate limit for this window.`,
        deferredUntil: grant.resetsAt,
        desk: deskId,
      });
    }

    const result = await signalSource().discover({
      desk,
      subreddits: scope.allowed,
      budget: grant.granted,
      now,
    });

    const existing = await repo.forDesk(deskId);
    const known = new Set(existing.map((s) => `${s.subreddit.toLowerCase()}:${s.postId}`));
    const index = buildIndex(await repo.all());

    const { signals, counts } = runPipeline({ desk, raw: result.signals, index, known, now });

    await repo.upsertMany(signals);
    await repo.markDiscovery(deskId, now.toISOString());

    res.json({
      counts,
      spent: result.spent,
      truncated: result.truncated,
      budget: { remaining: grant.remaining, resetsAt: grant.resetsAt, exhausted: grant.exhausted },
    });
  });

  /* ------------------------------ transitions -------------------------- */

  const ALLOWED_TRANSITIONS: SignalState[] = [
    'priority', 'watching', 'rejected', 'activated', 'replied', 'follow-up', 'qualified', 'closed',
  ];

  router.post('/signals/:id/state', guard, express.json({ limit: '4kb' }), async (req: Request, res: Response) => {
    const { state, note } = (req.body ?? {}) as { state?: SignalState; note?: string };

    if (!state || !ALLOWED_TRANSITIONS.includes(state)) return bad(res, 400, 'not a valid state');

    const signal = await repo.get(req.params.id);
    if (!signal) return bad(res, 404, 'no such signal');

    // A screened-out signal is terminal. Nothing an operator clicks can move a
    // crisis post or a blocked subreddit back into a working queue.
    if (signal.state === 'do-not-contact' || signal.state === 'blocked') {
      return bad(res, 403, `This signal is ${signal.state} and cannot be re-queued. ${signal.screenedReason ?? ''}`.trim());
    }

    // Engaging requires the channel action to actually be permitted.
    if ((state === 'replied' || state === 'activated') && !signal.actions.reply.allowed) {
      return bad(res, 403, `Cannot mark as ${state}: ${signal.actions.reply.reason}`);
    }

    const updated = await repo.update(signal.id, (s) => ({
      ...s,
      state,
      history: [...s.history, { at: clock().toISOString(), event: state, detail: note?.slice(0, 500) }],
    }));

    res.json({ signal: updated });
  });

  /* ------------------------------ policy view -------------------------- */

  router.get('/policy', guard, (_req: Request, res: Response) => {
    res.json({
      blocked: BLOCKED_SUBREDDITS.map((r) => ({ name: r.name, reason: r.reason })),
      note:
        'Blocked subreddits are never searched, never surfaced and never contacted, regardless of desk configuration. ' +
        'Replying requires a subreddit to be explicitly reviewed and marked; unlisted subreddits deny by default. ' +
        'Direct messaging is disabled everywhere.',
      desks: DESK_IDS.length,
    });
  });

  return router;
}
