import { Lock, Radio } from 'lucide-react';
import type { DeskSummary } from './api';
import { cn } from '../lib/utils';

/**
 * The ten desks. Deliberately boring: an operator should be able to read
 * "which desk has work waiting" in one glance and click straight into it.
 */
export const DeskGrid = ({
  summaries,
  selected,
  compact,
  onSelect,
}: {
  summaries: DeskSummary[];
  selected: string | null;
  compact: boolean;
  onSelect: (id: string) => void;
}) => (
  <div className={cn('grid gap-3', compact ? 'grid-cols-1 content-start' : 'sm:grid-cols-2 lg:grid-cols-3')}>
    {summaries.map(({ desk, counts, queue, budget }) => {
      const isSelected = desk.id === selected;
      const activated = queue.activated ?? 0;

      return (
        <button
          key={desk.id}
          onClick={() => onSelect(desk.id)}
          className={cn(
            'card text-left p-4 space-y-2.5 transition-colors',
            isSelected && 'border-primary bg-primary-dim',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-heading text-sm truncate">{desk.handle}</div>
              <div className="text-xs text-muted truncate">{desk.lens.pressure}</div>
            </div>
            {budget.exhausted ? (
              <span title={`Rate limit reached. Resumes ${new Date(budget.resetsAt).toLocaleTimeString()}`}>
                <Lock size={14} style={{ color: 'var(--warning)' }} />
              </span>
            ) : desk.auth === 'connected' ? (
              <Radio size={14} style={{ color: 'var(--calm)' }} />
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-muted">{desk.auth}</span>
            )}
          </div>

          {!compact && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
              <span className="text-body">
                <strong className="text-heading">{counts.discovered}</strong> discovered
              </span>
              <span className="text-body">
                <strong className="text-heading">{counts.relevant}</strong> relevant
              </span>
              <span className="text-body">
                <strong style={{ color: 'var(--primary)' }}>{queue.priority ?? 0}</strong> priority
              </span>
              <span className="text-body">
                <strong style={{ color: 'var(--calm)' }}>{activated}</strong> activated
              </span>
            </div>
          )}

          {compact && (
            <div className="text-xs text-muted tabular-nums">
              {queue.priority ?? 0} priority · {activated} activated
            </div>
          )}

          {!compact && counts.screenedOut > 0 && (
            <div className="text-xs text-muted">{counts.screenedOut} screened out</div>
          )}
        </button>
      );
    })}
  </div>
);
