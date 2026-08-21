import { STAGE_LABELS, STAGE_ORDER, stageIndex } from '../pw/funnel';
import type { FunnelStage } from '../pw/types';
import { cn } from '../lib/utils';

/**
 * The eight stages, shown honestly. A person can see how far in they are and
 * that there is an end to it — which matters when the alternative is a funnel
 * that feels like it could go on indefinitely.
 */
export const StageRail = ({ stage }: { stage: FunnelStage }) => {
  const current = stageIndex(stage);

  return (
    <div className="flex items-center gap-1.5" aria-label={`Stage ${current + 1} of ${STAGE_ORDER.length}: ${STAGE_LABELS[stage]}`}>
      {STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          title={STAGE_LABELS[s]}
          className={cn(
            'h-1 rounded-full transition-all duration-500',
            i < current && 'w-4 bg-primary/40',
            i === current && 'w-8 bg-primary',
            i > current && 'w-4 bg-surface-muted',
          )}
        />
      ))}
    </div>
  );
};
