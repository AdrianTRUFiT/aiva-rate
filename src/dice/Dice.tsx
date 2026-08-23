import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, LogOut, Radio, RefreshCw, ShieldAlert } from 'lucide-react';
import * as api from './api';
import type { DesksResponse, DeskView } from './api';
import { DeskGrid } from './DeskGrid';
import { Desk } from './Desk';
import { cn } from '../lib/utils';

const Metric = ({ label, value, tone }: { label: string; value: number | string; tone?: string }) => (
  <div className="min-w-[84px]">
    <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    <p className="text-lg font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
      {value}
    </p>
  </div>
);

/**
 * DICE — the ten-desk prospecting console.
 *
 * Overview of the desks, then one desk at a time. Switching desks loads that
 * desk's own queue and state; nothing is blended.
 */
export const Dice = ({ onSignOut }: { onSignOut: () => void }) => {
  const [overview, setOverview] = useState<DesksResponse | null>(null);
  const [deskId, setDeskId] = useState<string | null>(null);
  const [view, setView] = useState<DeskView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<Awaited<ReturnType<typeof api.loadPolicy>> | null>(null);
  const [showPolicy, setShowPolicy] = useState(false);

  // Derived aggregates the overview route doesn't precompute. Every number
  // here is a straight sum over the real per-desk counts/queue the server
  // already sent — no field is invented, no state is simulated client-side.
  const aggregate = useMemo(() => {
    const desks = overview?.desks ?? [];
    const sumQueue = (state: string) =>
      desks.reduce((n, d) => n + (d.queue[state as keyof typeof d.queue] ?? 0), 0);
    return {
      discovered: desks.reduce((n, d) => n + d.counts.discovered, 0),
      relevant: desks.reduce((n, d) => n + d.counts.relevant, 0),
      activated: sumQueue('activated'),
      followUp: sumQueue('follow-up'),
      qualified: sumQueue('qualified'),
    };
  }, [overview]);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await api.loadDesks());
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Opening a desk lands on the priority queue. The whole point of the
  // reduction is that an operator sees today's work, not the raw pool.
  const openDesk = useCallback(async (id: string, state: string | undefined = 'priority') => {
    setBusy(true);
    setError(null);
    try {
      setView(await api.loadDesk(id, state));
      setDeskId(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refreshOverview();
    api.loadPolicy().then(setPolicy).catch(() => setPolicy(null));
  }, [refreshOverview]);

  const runDiscovery = async () => {
    if (!deskId) return;
    setBusy(true);
    setError(null);
    try {
      await api.discover(deskId);
      await openDesk(deskId, 'priority');
      await refreshOverview();
    } catch (err) {
      const e = err as api.DiceError;
      // A rate-limited desk defers. It does not continue on another desk.
      setError(
        e.status === 429 && e.extra?.deferredUntil
          ? `${e.message} Resumes ${new Date(String(e.extra.deferredUntil)).toLocaleTimeString()}.`
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (!overview) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl">DICE</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Radio size={11} style={{ color: overview.simulated ? 'var(--warning)' : 'var(--calm)' }} />
            Source <strong className="text-heading">{overview.source}</strong>
            {overview.simulated && <span style={{ color: 'var(--warning)' }}>· simulated</span>}
            <span>· {overview.desks.length} desks</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {deskId && (
            <button onClick={runDiscovery} disabled={busy} className="btn-secondary inline-flex items-center gap-2 text-sm">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Discover
            </button>
          )}
          <button onClick={onSignOut} className="btn-quiet inline-flex items-center gap-1.5 no-underline">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Header metrics — every figure is a real sum of what the server sent. */}
      <div className="card p-4 flex flex-wrap gap-x-8 gap-y-3">
        <Metric label="Discovered" value={aggregate.discovered.toLocaleString()} />
        <Metric label="Relevant" value={aggregate.relevant.toLocaleString()} />
        <Metric label="Priority" value={overview.totals.priority} tone="var(--primary)" />
        <Metric label="Activated" value={aggregate.activated} tone="var(--calm)" />
        <Metric label="Follow-up" value={aggregate.followUp} />
        <Metric label="Qualified" value={aggregate.qualified} />
        <Metric label="Screened out" value={overview.totals.screenedOut} />
      </div>

      {overview.simulated && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'var(--warning-dim, rgba(180,118,42,0.10))', color: 'var(--warning)' }}
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <div>
            <strong>Simulated desks.</strong>{' '}
            <span className="text-body">
              No Reddit credentials are configured, so every desk is running against the fixture
              source with simulated auth. Nothing here is a real Reddit account, no post is real,
              and no action reaches Reddit.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(168,68,60,0.10)', color: 'var(--critical)' }}
        >
          <ShieldAlert size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {policy && (
        <div className="card p-4">
          <button
            onClick={() => setShowPolicy(!showPolicy)}
            className="flex items-center gap-2 text-sm text-body w-full text-left"
          >
            <ChevronDown
              size={15}
              className={cn('transition-transform shrink-0', !showPolicy && '-rotate-90')}
            />
            <span>
              <strong className="text-heading">{policy.blocked.length} subreddits</strong> are never
              searched, surfaced or contacted. Direct messaging is off everywhere.
            </span>
          </button>
          {showPolicy && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <p className="text-xs text-muted">{policy.note}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {policy.blocked.map((r) => (
                  <div key={r.name} className="text-xs">
                    <span className="text-heading font-medium">r/{r.name}</span>{' '}
                    <span className="text-muted">{r.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={cn('grid gap-6', deskId ? 'lg:grid-cols-[280px_1fr]' : '')}>
        <DeskGrid
          summaries={overview.desks}
          selected={deskId}
          compact={Boolean(deskId)}
          onSelect={(id) => void openDesk(id)}
        />
        {deskId && view && (
          <Desk
            view={view}
            busy={busy}
            onFilter={(state) => void openDesk(deskId, state)}
            onChanged={async () => {
              await openDesk(deskId);
              await refreshOverview();
            }}
          />
        )}
      </div>
    </div>
  );
};
