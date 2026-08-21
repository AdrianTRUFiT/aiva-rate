import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { compose } from '../pw/promptEngine';
import { getPressure, PRESSURE_ORDER, PRESSURE_MOMENTS } from '../pw/pressure';
import { Disclosure, SoulHostBadge } from '../ui/SoulHost';
import { cn } from '../lib/utils';

/**
 * Empathy and understanding — the first two doctrine stages, and the first
 * conversion, which is emotional rather than financial.
 *
 * The classifier's decision is stated out loud and is correctable. A system
 * that silently routes someone to the wrong door and then insists is worse
 * than one that asks.
 */
export const Reflection = () => {
  const session = useSession((s) => s.session);
  const uncertain = useSession((s) => s.uncertain);
  const correctPressure = useSession((s) => s.correctPressure);
  const advance = useSession((s) => s.advance);
  const [picking, setPicking] = useState(false);

  const copy = useMemo(() => {
    if (!session.persona || !session.pressure || !session.intervention) return null;
    return compose(session.persona, session.pressure, session.intervention);
  }, [session.persona, session.pressure, session.intervention]);

  if (!copy || !session.pressure || !session.persona) return null;
  const moment = getPressure(session.pressure);

  return (
    <div className="px-6 py-14">
      <div className="max-w-xl mx-auto space-y-8">
        <SoulHostBadge />

        <div className="space-y-6">
          <p className="text-xl md:text-2xl text-heading leading-snug">{copy.empathy}</p>
          <p className="text-body">{copy.understanding}</p>
          <p
            className="text-lg text-heading font-medium border-l-2 pl-5 py-1"
            style={{ borderColor: 'var(--primary)' }}
          >
            {copy.reframe}
          </p>
        </div>

        {/* The door the classifier picked, made visible and reversible. */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-1">
                {uncertain ? 'Best guess at what this is' : 'What this sounds like'}
              </p>
              <p className="text-heading font-semibold">{moment.label}</p>
            </div>
            <button onClick={() => setPicking(!picking)} className="btn-quiet shrink-0">
              {picking ? 'Never mind' : 'Not quite'}
            </button>
          </div>

          {picking && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {PRESSURE_ORDER.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    correctPressure(id);
                    setPicking(false);
                  }}
                  className={cn(
                    'text-left text-sm px-3 py-2.5 rounded-xl border transition-colors',
                    id === session.pressure
                      ? 'border-primary text-heading bg-primary-dim'
                      : 'border-border text-body hover:border-border-hover hover:bg-surface-muted',
                  )}
                >
                  {PRESSURE_MOMENTS[id].label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button onClick={() => advance('EDUCATION')} className="btn-primary inline-flex items-center gap-2">
            Go on
            <ArrowRight size={17} />
          </button>
        </div>

        <div className="pt-6 border-t border-border">
          <Disclosure />
        </div>
      </div>
    </div>
  );
};
