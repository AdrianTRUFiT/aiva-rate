import { useState } from 'react';
import { AlertTriangle, ArrowUpRight, Ban, Check, Clock, Eye, Lock, Search, Users } from 'lucide-react';
import * as api from './api';
import type { DeskView, Recommendation, Signal, SignalState } from './api';
import { SignalDetail } from './SignalDetail';
import { cn } from '../lib/utils';

/**
 * One desk's inbox.
 *
 * Filters across the top, then a card per opportunity carrying the post, the
 * scores, why DICE selected it, what AIOP recommends, and the actions the
 * policy layer actually permits.
 */

const FILTERS: { state: SignalState | 'all'; label: string }[] = [
  { state: 'priority', label: 'Priority' },
  { state: 'new', label: 'New' },
  { state: 'watching', label: 'Watching' },
  { state: 'activated', label: 'Activated' },
  { state: 'replied', label: 'Replied' },
  { state: 'follow-up', label: 'Follow-up' },
  { state: 'qualified', label: 'Qualified' },
  { state: 'closed', label: 'Closed' },
  { state: 'rejected', label: 'Rejected' },
  { state: 'do-not-contact', label: 'Screened out' },
  { state: 'all', label: 'Everything' },
];

const Score = ({ label, value }: { label: string; value: number | string }) => (
  <span className="text-xs text-muted">
    {label} <strong className="text-heading tabular-nums">{value}</strong>
  </span>
);

const VERDICT_STYLE: Record<string, { bg: string; fg: string }> = {
  act: { bg: 'rgba(74,124,111,0.14)', fg: 'var(--calm)' },
  watch: { bg: 'var(--primary-dim)', fg: 'var(--primary)' },
  pass: { bg: 'var(--surface-muted)', fg: 'var(--muted)' },
};

export const Desk = ({
  view,
  busy,
  onFilter,
  onChanged,
}: {
  view: DeskView;
  busy: boolean;
  onFilter: (state?: string) => void;
  onChanged: () => Promise<void>;
}) => {
  const [active, setActive] = useState<string>('priority');
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The opened signal is captured by value, not looked up by id each render:
  // once activated it can fall out of the current (filtered) queue, and the
  // panel should keep showing what the operator just did, not disappear.
  const [openSignal, setOpenSignal] = useState<(Signal & { aiop: Recommendation }) | null>(null);

  const transition = async (id: string, state: SignalState) => {
    setPending(id);
    setActionError(null);
    try {
      await api.setState(id, state);
      await onChanged();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setPending(null);
    }
  };

  const { counts, budget, scope, desk } = view;

  return (
    <div className="space-y-5 min-w-0">
      {/* The reduction, stated plainly — this is the productivity claim. */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm tabular-nums">
          <span className="text-body">{counts.discovered} discovered</span>
          <span className="text-muted">→</span>
          <span className="text-body">{counts.relevant} relevant</span>
          <span className="text-muted">→</span>
          <span className="text-body">{counts.strong} strong</span>
          <span className="text-muted">→</span>
          <strong style={{ color: 'var(--primary)' }}>{counts.priorityToday} worth today</strong>
          {counts.screenedOut > 0 && (
            <span className="text-xs text-muted ml-auto">{counts.screenedOut} screened out</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border text-xs text-muted">
          <span>
            Budget {budget.used}/{budget.limit}
            {budget.exhausted && (
              <strong style={{ color: 'var(--warning)' }}>
                {' '}· limit reached, resumes {new Date(budget.resetsAt).toLocaleTimeString()}
              </strong>
            )}
          </span>
          <span>Searching r/{scope.searchable.join(', r/')}</span>
          {scope.refused.length > 0 && (
            <span style={{ color: 'var(--warning)' }}>
              {scope.refused.length} configured subreddit{scope.refused.length === 1 ? '' : 's'} refused by policy
            </span>
          )}
          {desk.simulated && <span style={{ color: 'var(--warning)' }}>simulated desk</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f.state === 'all' ? view.signals.length : view.queue[f.state as SignalState] ?? 0;
          return (
            <button
              key={f.state}
              onClick={() => {
                setActive(f.state);
                onFilter(f.state === 'all' ? undefined : f.state);
              }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                active === f.state ? 'text-heading bg-surface-muted' : 'text-muted hover:text-body',
              )}
            >
              {f.label} {count > 0 && <span className="tabular-nums opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {actionError && (
        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(168,68,60,0.10)', color: 'var(--critical)' }}>
          {actionError}
        </div>
      )}

      {view.signals.length === 0 && !busy && (
        <p className="text-sm text-muted py-8 text-center">
          {active === 'priority'
            ? 'Nothing meets the priority bar right now. Run discovery, or look at New.'
            : 'Nothing in this queue.'}
        </p>
      )}

      <div className="space-y-3">
        {view.signals.map((signal) => {
          const screened = signal.state === 'do-not-contact' || signal.state === 'blocked';
          const verdict = VERDICT_STYLE[signal.aiop.verdict] ?? VERDICT_STYLE.pass;

          return (
            <div key={signal.id} className={cn('card p-5 space-y-4', screened && 'opacity-70')}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>r/{signal.subreddit}</span>
                    <span>·</span>
                    <span>u/{signal.author}</span>
                    <span>·</span>
                    <Clock size={11} />
                    <span className="tabular-nums">{Math.round(signal.scores.freshnessHours)}h</span>
                  </div>
                  <button
                    onClick={() => setOpenSignal(signal)}
                    className="text-base font-semibold text-heading text-left hover:underline"
                  >
                    {signal.title}
                  </button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: verdict.bg, color: verdict.fg }}
                  >
                    {signal.aiop.verdict}
                  </span>
                  <button
                    onClick={() => setOpenSignal(signal)}
                    className="btn-quiet p-1 no-underline"
                    title="Open full detail"
                    aria-label="Open full detail"
                  >
                    <Search size={14} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-body">{signal.excerpt}</p>

              {screened ? (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl text-sm"
                  style={{ background: 'var(--surface-muted)' }}
                >
                  <Ban size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--critical)' }} />
                  <div>
                    <strong className="text-heading">Screened out.</strong>{' '}
                    <span className="text-body">{signal.screenedReason}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-4">
                    <Score label="Fit" value={signal.scores.fit} />
                    <Score label="Intent" value={signal.scores.intent} />
                    <Score label="Priority" value={signal.scores.priority} />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="eyebrow mb-1">Why DICE selected it</p>
                      <ul className="text-body space-y-0.5">
                        {signal.reasons.map((r, i) => (
                          <li key={i}>· {r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2">
                      <p className="eyebrow mb-1">AIOP</p>
                      <p className="text-body">{signal.aiop.rationale}</p>
                      <p className="text-heading mt-1.5">{signal.aiop.nextAction}</p>
                      {signal.aiop.unknowns.length > 0 && (
                        <ul className="text-muted text-xs mt-1.5 space-y-0.5">
                          {signal.aiop.unknowns.map((u, i) => (
                            <li key={i}>? {u}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {signal.collision && (
                    <div
                      className="flex items-start gap-2 p-3 rounded-xl text-sm"
                      style={{ background: 'rgba(180,118,42,0.10)', color: 'var(--warning)' }}
                    >
                      <Users size={15} className="mt-0.5 shrink-0" />
                      <span>
                        <strong>Collision.</strong>{' '}
                        <span className="text-body">
                          {signal.collision.deskId} already engaged this{' '}
                          {signal.collision.on === 'author' ? 'person' : 'thread'}. Another desk must
                          not act until that is resolved.
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                    <a
                      href={signal.permalink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn-quiet inline-flex items-center gap-1 no-underline text-xs pt-3"
                    >
                      Open source <ArrowUpRight size={12} />
                    </a>

                    <div className="flex flex-wrap gap-2 ml-auto pt-3">
                      <button
                        onClick={() => transition(signal.id, 'watching')}
                        disabled={pending === signal.id}
                        className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                      >
                        <Eye size={13} /> Watch
                      </button>
                      <button
                        onClick={() => transition(signal.id, 'rejected')}
                        disabled={pending === signal.id}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => transition(signal.id, 'activated')}
                        disabled={pending === signal.id || !signal.actions.reply.allowed}
                        title={signal.actions.reply.reason}
                        className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                      >
                        {signal.actions.reply.allowed ? <Check size={13} /> : <Lock size={13} />}
                        Activate
                      </button>
                    </div>
                  </div>

                  {!signal.actions.reply.allowed && (
                    <p className="flex items-start gap-1.5 text-xs text-muted">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {signal.actions.reply.reason}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {openSignal && (
        <SignalDetail
          signal={openSignal}
          onClose={() => setOpenSignal(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
};
