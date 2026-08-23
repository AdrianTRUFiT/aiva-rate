import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Check,
  Clock,
  Eye,
  Lock,
  Users,
  X,
} from 'lucide-react';
import * as api from './api';
import type { Recommendation, Signal, SignalState } from './api';
import { cn } from '../lib/utils';

/**
 * One signal, in full.
 *
 * The queue card is a triage surface; this is the decision surface. It shows
 * everything the backend actually holds for a signal — all six AIOP fields
 * (the card only has room for three), the captured post, the scores, the
 * policy gates, collisions, and the state history — and it keeps the signal
 * on screen after a transition so the operator can see what their action
 * produced instead of watching the row vanish from a filtered queue.
 *
 * Nothing here is invented. Where the backend has no field, this says so
 * rather than showing a plausible-looking blank.
 */

type FullSignal = Signal & { aiop: Recommendation };

const VERDICT_STYLE: Record<string, { bg: string; fg: string }> = {
  act: { bg: 'rgba(74,124,111,0.14)', fg: 'var(--calm)' },
  watch: { bg: 'var(--primary-dim)', fg: 'var(--primary)' },
  pass: { bg: 'var(--surface-muted)', fg: 'var(--muted)' },
};

/** States an operator can move a signal into from this panel. */
const TRANSITIONS: { state: SignalState; label: string; kind: 'primary' | 'secondary' }[] = [
  { state: 'watching', label: 'Watch', kind: 'secondary' },
  { state: 'rejected', label: 'Reject', kind: 'secondary' },
  { state: 'activated', label: 'Activate', kind: 'primary' },
];

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="eyebrow mb-1">{label}</p>
    <div className="text-sm text-body">{children}</div>
  </div>
);

export const SignalDetail = ({
  signal,
  onClose,
  onChanged,
}: {
  signal: FullSignal;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) => {
  // `live` starts as the queue's copy and is replaced by whatever the state
  // route returns, so the panel reflects the real persisted signal.
  const [live, setLive] = useState<Signal>(signal);
  const [pending, setPending] = useState<SignalState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignalState | null>(null);

  useEffect(() => {
    setLive(signal);
    setResult(null);
    setError(null);
  }, [signal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const transition = async (state: SignalState) => {
    setPending(state);
    setError(null);
    try {
      const { signal: updated } = await api.setState(live.id, state);
      setLive(updated);
      setResult(state);
      // Refresh the desk behind the panel so counts and queues stay truthful.
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  };

  const { aiop } = signal;
  const verdict = VERDICT_STYLE[aiop.verdict] ?? VERDICT_STYLE.pass;
  const screened = live.state === 'do-not-contact' || live.state === 'blocked';
  const replyGate = live.actions.reply;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={live.title}
    >
      <div
        className="card w-full max-w-3xl my-4 p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: identity, current state, verdict */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>r/{live.subreddit}</span>
                <span>·</span>
                <span>u/{live.author}</span>
                <span>·</span>
                <Clock size={11} />
                <span className="tabular-nums">{Math.round(live.scores.freshnessHours)}h old</span>
                <span>·</span>
                <span className="tabular-nums">{live.source}</span>
              </div>
              <h2 className="text-lg font-semibold text-heading">{live.title}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                style={{ background: verdict.bg, color: verdict.fg }}
              >
                {aiop.verdict}
              </span>
              <button onClick={onClose} className="btn-quiet p-1 no-underline" aria-label="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className="text-muted">
              State{' '}
              <strong className="text-heading uppercase tracking-wide">{live.state}</strong>
            </span>
            <span className="text-muted tabular-nums">Fit <strong className="text-heading">{live.scores.fit}</strong></span>
            <span className="text-muted tabular-nums">Intent <strong className="text-heading">{live.scores.intent}</strong></span>
            <span className="text-muted tabular-nums">Priority <strong className="text-heading">{live.scores.priority}</strong></span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Result of the operator's own action, kept on screen. */}
          {result && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(74,124,111,0.14)', color: 'var(--calm)' }}
            >
              <Check size={15} className="mt-0.5 shrink-0" />
              <div>
                <strong>Now {result}.</strong>{' '}
                <span className="text-body">
                  Recorded on this signal and reflected in the desk queue behind this panel.
                  {result === 'activated' && ' Next action is below — nothing was sent to Reddit.'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div
              className="p-3 rounded-xl text-sm"
              style={{ background: 'rgba(168,68,60,0.10)', color: 'var(--critical)' }}
            >
              {error}
            </div>
          )}

          {screened && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'var(--surface-muted)' }}
            >
              <Ban size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--critical)' }} />
              <div>
                <strong className="text-heading">Screened out.</strong>{' '}
                <span className="text-body">{live.screenedReason}</span>
              </div>
            </div>
          )}

          {/* The captured post. Labelled by what was actually captured. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Signal context (as captured)</p>
              <a
                href={live.permalink}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-quiet inline-flex items-center gap-1 no-underline text-xs"
              >
                Open source <ArrowUpRight size={12} />
              </a>
            </div>
            <div
              className="p-3 rounded-xl text-sm text-body whitespace-pre-wrap max-h-64 overflow-y-auto"
              style={{ background: 'var(--surface-muted)' }}
            >
              {live.excerpt || <span className="text-muted">No body text was captured.</span>}
            </div>
          </div>

          <Row label="Why DICE selected it">
            <ul className="space-y-0.5">
              {live.reasons.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
          </Row>

          {/* All six AIOP fields. The card shows three; this shows everything. */}
          <div className="space-y-3 pt-1 border-t border-border">
            <p className="eyebrow pt-3">AIOP recommendation</p>
            <Row label="Reading">{aiop.reading}</Row>
            <Row label="Contribution">{aiop.contribution}</Row>
            <Row label="Unknowns">
              {aiop.unknowns.length > 0 ? (
                <ul className="space-y-0.5">
                  {aiop.unknowns.map((u, i) => (
                    <li key={i} className="text-muted">? {u}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted">None recorded.</span>
              )}
            </Row>
            <Row label="Rationale">{aiop.rationale}</Row>
            <Row label="Next action">
              <span className="text-heading">{aiop.nextAction}</span>
            </Row>
          </div>

          {live.collision && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(180,118,42,0.10)', color: 'var(--warning)' }}
            >
              <Users size={15} className="mt-0.5 shrink-0" />
              <span>
                <strong>Collision.</strong>{' '}
                <span className="text-body">
                  {live.collision.deskId} already engaged this{' '}
                  {live.collision.on === 'author' ? 'person' : 'thread'} (
                  {live.collision.state}, {new Date(live.collision.at).toLocaleString()}).
                </span>
              </span>
            </div>
          )}

          {/* State history — the closest thing the backend has to a case log. */}
          <div className="pt-1 border-t border-border">
            <p className="eyebrow pt-3 mb-2">History</p>
            {live.history.length === 0 ? (
              <p className="text-sm text-muted">No events recorded yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {live.history.map((h, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-muted tabular-nums shrink-0 text-xs pt-0.5">
                      {new Date(h.at).toLocaleString()}
                    </span>
                    <span className="text-body">
                      <strong className="text-heading">{h.event}</strong>
                      {h.detail ? ` — ${h.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Actions, gated exactly as the policy layer gates them. */}
          {!screened && (
            <div className="pt-4 border-t border-border space-y-2">
              <div className="flex flex-wrap gap-2">
                {TRANSITIONS.map(({ state, label, kind }) => {
                  const gated = state === 'activated' && !replyGate.allowed;
                  const isCurrent = live.state === state;
                  return (
                    <button
                      key={state}
                      onClick={() => transition(state)}
                      disabled={pending !== null || gated || isCurrent}
                      title={gated ? replyGate.reason : isCurrent ? `Already ${state}` : undefined}
                      className={cn(
                        'text-xs py-1.5 px-3 inline-flex items-center gap-1.5',
                        kind === 'primary' ? 'btn-primary' : 'btn-secondary',
                      )}
                    >
                      {state === 'activated' ? (
                        replyGate.allowed ? <Check size={13} /> : <Lock size={13} />
                      ) : state === 'watching' ? (
                        <Eye size={13} />
                      ) : null}
                      {isCurrent ? `${label}ed` : label}
                    </button>
                  );
                })}
              </div>
              {!replyGate.allowed && (
                <p className="flex items-start gap-1.5 text-xs text-muted">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {replyGate.reason}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
