import { useMemo } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { compose } from '../pw/promptEngine';
import { SoulHostBadge } from '../ui/SoulHost';

/**
 * Education — one idea, small enough to keep.
 *
 * This is the stage that turns a nice interaction into capability. It is
 * deliberately one paragraph: the goal is that the person could explain the
 * exercise to someone else tomorrow, not that they feel taught.
 */
export const Education = () => {
  const session = useSession((s) => s.session);
  const advance = useSession((s) => s.advance);

  const copy = useMemo(() => {
    if (!session.persona || !session.pressure || !session.intervention) return null;
    return compose(session.persona, session.pressure, session.intervention);
  }, [session.persona, session.pressure, session.intervention]);

  if (!copy || !session.intervention || !session.persona) return null;
  const { intervention } = session;

  return (
    <div className="px-6 py-14">
      <div className="max-w-xl mx-auto space-y-8">
        <SoulHostBadge />

        <div className="space-y-5">
          <h1 className="text-2xl">{intervention.name}</h1>
          <p className="text-body text-lg leading-relaxed">{copy.education}</p>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Clock size={15} />
            <span>
              {intervention.steps.length} steps · about{' '}
              {Math.round(intervention.durationSeconds / 60)} minute
              {intervention.durationSeconds >= 90 ? 's' : ''}
            </span>
          </div>
          <ol className="space-y-2.5">
            {intervention.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-body">
                <span className="text-muted tabular-nums shrink-0">{i + 1}.</span>
                <span>{step.instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <button onClick={() => advance('ACTION')} className="btn-primary inline-flex items-center gap-2">
            Take me through it
            <ArrowRight size={17} />
          </button>
          <p className="text-xs text-muted">
            It's guided one step at a time. You can stop at any point without losing anything.
          </p>
        </div>
      </div>
    </div>
  );
};
