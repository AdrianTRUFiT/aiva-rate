import { useState } from 'react';
import { Ban, Check, Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import * as api from './api';
import type { Lens } from './api';

/**
 * The desk's listening lens, editable.
 *
 * Subreddits, cues, exclusions and thresholds are configuration now rather than
 * code. What an operator cannot do is add a subreddit the policy floor blocks —
 * that save is refused with the reason, not quietly stripped.
 */

const listToText = (values: string[]) => values.join('\n');
const textToList = (text: string) =>
  text.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);

const Field = ({
  label,
  hint,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) => (
  <div className="space-y-1.5">
    <label className="eyebrow">{label}</label>
    <textarea
      className="input-field text-xs font-mono resize-y"
      style={{ minHeight: `${rows * 1.6}rem` }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <p className="text-xs text-muted">{hint}</p>
  </div>
);

export const LensEditor = ({
  deskId,
  lens,
  onSaved,
}: {
  deskId: string;
  lens: Lens;
  onSaved: () => Promise<void>;
}) => {
  const [subreddits, setSubreddits] = useState(listToText(lens.subreddits));
  const [keywords, setKeywords] = useState(listToText(lens.keywords));
  const [exclusions, setExclusions] = useState(listToText(lens.exclusions));
  const [minScore, setMinScore] = useState(lens.minScore);
  const [maxAgeHours, setMaxAgeHours] = useState(lens.maxAgeHours);

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refused, setRefused] = useState<{ name: string; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setRefused([]);
    setSaved(false);
    try {
      await api.saveLens(deskId, {
        subreddits: textToList(subreddits),
        keywords: textToList(keywords),
        exclusions: textToList(exclusions),
        minScore,
        maxAgeHours,
      });
      setSaved(true);
      await onSaved();
    } catch (err) {
      const e = err as api.DiceError;
      if (e.status === 422 && Array.isArray(e.extra?.refused)) {
        setRefused(e.extra.refused as { name: string; reason: string }[]);
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSubreddits(listToText(lens.defaults.subreddits));
    setKeywords(listToText(lens.defaults.keywords));
    setExclusions(listToText(lens.defaults.exclusions));
    setMinScore(45);
    setMaxAgeHours(168);
  };

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} style={{ color: 'var(--primary)' }} />
          <h3 className="text-sm font-semibold text-heading">Listening lens</h3>
        </div>
        {lens.edited && <span className="text-xs text-muted">edited</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Subreddits"
          hint="One per line, without r/."
          value={subreddits}
          onChange={setSubreddits}
        />
        <Field
          label="Keywords / cues"
          hint="Phrases this desk listens for."
          value={keywords}
          onChange={setKeywords}
        />
        <Field
          label="Exclusions"
          hint="Phrases that disqualify a post."
          value={exclusions}
          onChange={setExclusions}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="lens-min">
            Minimum score — {minScore}
          </label>
          <input
            id="lens-min"
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted">Anything below this is rejected rather than queued.</p>
        </div>
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="lens-age">
            Recency window — {maxAgeHours}h
          </label>
          <input
            id="lens-age"
            type="range"
            min={1}
            max={336}
            value={maxAgeHours}
            onChange={(e) => setMaxAgeHours(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-muted">Older posts are dropped. Unknown ages are kept.</p>
        </div>
      </div>

      {refused.length > 0 && (
        <div
          className="p-3 rounded-xl space-y-1.5 text-sm"
          style={{ background: 'rgba(168,68,60,0.10)' }}
        >
          <p className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--critical)' }}>
            <Ban size={14} /> Not saved — these subreddits are permanently off-limits
          </p>
          {refused.map((r) => (
            <p key={r.name} className="text-xs text-body">
              <strong>r/{r.name}</strong> — {r.reason}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: 'var(--critical)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button onClick={save} disabled={busy} className="btn-primary text-sm py-2 inline-flex items-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? 'Saved' : 'Save lens'}
        </button>
        <button onClick={reset} className="btn-quiet inline-flex items-center gap-1.5 no-underline">
          <RotateCcw size={12} /> Restore defaults
        </button>
      </div>
    </div>
  );
};
