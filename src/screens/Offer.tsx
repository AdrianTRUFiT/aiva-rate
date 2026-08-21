import { useMemo, useState } from 'react';
import { Check, ShieldAlert } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { buildResetPlan, RESET_OFFER } from '../pw/continuity';
import { Enroll } from './Enroll';

/**
 * The transaction — offered once, plainly, after something already worked.
 *
 * The gate is re-checked here rather than trusted from the previous screen,
 * and again on the server before a charge is created. A commercial offer
 * reachable by a routing bug is exactly the failure this architecture exists
 * to prevent.
 *
 * The week is shown as seven exercises, not seven personalities. The guides
 * chose them; the person does not need to meet the guides.
 */
export const Offer = () => {
  const session = useSession((s) => s.session);
  const decline = useSession((s) => s.declineOffer);
  const reset = useSession((s) => s.reset);
  const decision = useSession((s) => s.offerDecision)();
  const [enrolling, setEnrolling] = useState(false);

  const plan = useMemo(
    () => (session.pressure ? buildResetPlan(session.pressure) : []),
    [session.pressure],
  );

  if (!decision.allowed) {
    return (
      <div className="px-6 py-14">
        <div className="max-w-xl mx-auto card p-6 space-y-3">
          <div className="flex items-center gap-2 text-heading font-semibold">
            <ShieldAlert size={18} style={{ color: 'var(--warning)' }} />
            Offer withheld
          </div>
          <p className="text-sm text-body">{decision.reason}</p>
          <button onClick={reset} className="btn-quiet">
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (session.outcome === 'DECLINED') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-14">
        <div className="max-w-md space-y-5 text-center">
          <h1 className="text-2xl">Good. You got what you came for.</h1>
          <p className="text-body">
            The exercise you just did is yours now — it works the same way the next time, with or
            without us. Nothing will be sent to you.
          </p>
          <button onClick={reset} className="btn-quiet">
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (enrolling) return <Enroll onBack={() => setEnrolling(false)} />;

  return (
    <div className="px-6 py-14">
      <div className="max-w-xl mx-auto space-y-9">
        <div className="space-y-4">
          <p className="eyebrow">The next seven days</p>
          <h1 className="text-2xl md:text-3xl leading-snug">{RESET_OFFER.name}</h1>
          <p className="text-body text-lg">{RESET_OFFER.promise}</p>
        </div>

        <div className="card p-5 space-y-3">
          {RESET_OFFER.commitments.map((c) => (
            <div key={c} className="flex items-start gap-3 text-sm">
              <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--calm)' }} />
              <span className="text-body">{c}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="eyebrow">Built around what you came in with</p>
          <div className="space-y-2">
            {plan.map((day) => (
              <div key={day.day} className="flex items-baseline gap-4 px-4 py-3 rounded-xl bg-surface-muted">
                <span className="text-xs text-muted tabular-nums w-11 shrink-0">Day {day.day}</span>
                <span className="text-sm text-body">{day.intervention.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 pt-2">
          <button onClick={() => setEnrolling(true)} className="btn-primary">
            Yes, walk me through the week
          </button>
          <button onClick={decline} className="btn-quiet">
            {RESET_OFFER.decline}
          </button>
        </div>
      </div>
    </div>
  );
};
