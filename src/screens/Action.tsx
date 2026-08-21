import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, SkipForward, Check } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { SoulHostMark } from '../ui/SoulHost';
import { cn } from '../lib/utils';

/**
 * The guided runner.
 *
 * One step on screen at a time, on a timer the person controls. The timer
 * exists to slow people down — the failure mode of a written exercise is that
 * it gets skim-read in nine seconds and judged useless.
 */
export const Action = () => {
  const session = useSession((s) => s.session);
  const complete = useSession((s) => s.completeIntervention);

  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(true);
  const intervention = session.intervention;
  const stepCount = intervention?.steps.length ?? 0;

  // Reset the runner whenever a different exercise is bound (e.g. after a
  // checkpoint where nothing shifted and a new one was selected).
  useEffect(() => {
    setIndex(0);
    setRunning(true);
    setRemaining(intervention?.steps[0]?.seconds ?? 0);
  }, [intervention?.id]);

  const next = useCallback(() => {
    setIndex((i) => {
      const n = i + 1;
      if (n < stepCount) {
        setRemaining(intervention?.steps[n]?.seconds ?? 0);
        return n;
      }
      setRunning(false);
      return i;
    });
  }, [intervention, stepCount]);

  const onLastStep = index === stepCount - 1;

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const t = setTimeout(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // Auto-advance, except on the last step where we stop and wait.
          if (index < stepCount - 1) next();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [running, remaining, index, stepCount, next]);

  if (!intervention) return null;

  const step = intervention.steps[index];
  const pct = step.seconds > 0 ? ((step.seconds - remaining) / step.seconds) * 100 : 100;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-14">
      <div className="w-full max-w-xl space-y-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SoulHostMark size={28} />
            <span className="text-sm text-muted">{intervention.name}</span>
          </div>
          <span className="text-sm text-muted tabular-nums">
            Step {index + 1} of {stepCount}
          </span>
        </div>

        <div className="space-y-5 min-h-[9rem]" aria-live="polite">
          <h1 className="text-2xl md:text-3xl leading-snug">{step.instruction}</h1>
          {step.detail && <p className="text-body text-lg">{step.detail}</p>}
        </div>

        <div className="space-y-3">
          <div className="h-1 w-full rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%`, background: 'var(--primary)' }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted tabular-nums">
              {remaining > 0 ? `${remaining}s` : 'Take as long as you need'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRunning((r) => !r)}
                className="p-2 rounded-full text-muted hover:text-body hover:bg-surface-muted transition-colors"
                aria-label={running ? 'Pause' : 'Resume'}
              >
                {running ? <Pause size={17} /> : <Play size={17} />}
              </button>
              {!onLastStep && (
                <button
                  onClick={next}
                  className="p-2 rounded-full text-muted hover:text-body hover:bg-surface-muted transition-colors"
                  aria-label="Next step"
                >
                  <SkipForward size={17} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex flex-wrap items-center gap-4">
          <button
            onClick={complete}
            className={cn(
              'inline-flex items-center gap-2',
              onLastStep ? 'btn-primary' : 'btn-secondary',
            )}
          >
            <Check size={17} />
            {onLastStep ? "That's it" : "I'm done with this"}
          </button>
          <p className="text-xs text-muted">
            Stopping early is fine. You'll still be asked whether anything changed.
          </p>
        </div>
      </div>
    </div>
  );
};
