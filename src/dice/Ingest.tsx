import { useState } from 'react';
import { AlertTriangle, ClipboardPaste, Loader2 } from 'lucide-react';
import * as api from './api';
import type { IngestResult } from './api';

const PLACEHOLDER = `https://www.reddit.com/r/jobs/comments/abc123/laid_off_this_morning/
u/their_handle
posted: 2h
Paste the post text here if you have it — it sharpens the score.

https://www.reddit.com/r/layoffs/comments/def456/role_eliminated/`;

/**
 * Operator-assisted ingest.
 *
 * Paste what you found. A line that is a URL starts a new post; anything after
 * it is that post's text. So a bare list of links works, and so does a list of
 * links with the posts pasted underneath.
 *
 * Nothing here fetches Reddit. Everything comes from what the operator could
 * already see in their own browser.
 */
export const Ingest = ({
  deskId,
  onIngested,
}: {
  deskId: string;
  onIngested: () => Promise<void>;
}) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await api.ingest(deskId, text);
      setResult(outcome);
      setText('');
      await onIngested();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardPaste size={16} style={{ color: 'var(--primary)' }} />
        <h3 className="text-sm font-semibold text-heading">Paste Reddit posts</h3>
      </div>

      <textarea
        className="input-field min-h-[150px] resize-y font-mono text-xs leading-relaxed"
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button onClick={submit} disabled={!text.trim() || busy} className="btn-primary text-sm py-2 inline-flex items-center gap-2">
          {busy && <Loader2 size={14} className="animate-spin" />}
          Process
        </button>
        <p className="text-xs text-muted">
          One URL per post. Optional <code>u/handle</code> and <code>posted: 3h</code> lines.
        </p>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--critical)' }}>
          {error}
        </p>
      )}

      {result && (
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-sm tabular-nums">
            <strong className="text-heading">{result.accepted}</strong> pasted →{' '}
            <strong className="text-heading">{result.counts.afterDedup}</strong> new →{' '}
            <strong className="text-heading">{result.counts.relevant}</strong> relevant →{' '}
            <strong style={{ color: 'var(--primary)' }}>{result.counts.priorityToday}</strong> priority
            {result.counts.screenedOut > 0 && (
              <span className="text-muted"> · {result.counts.screenedOut} screened out</span>
            )}
          </p>
          <p className="text-xs text-muted">{result.note}</p>
          {result.failures.length > 0 && (
            <div className="space-y-1 pt-1">
              {result.failures.map((f, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--warning)' }}>
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="font-mono break-all">{f.line.slice(0, 60)}</span> — {f.reason}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
