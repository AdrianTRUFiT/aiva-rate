import { ArrowRight, LifeBuoy } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { PersonaBadge } from '../ui/PersonaBadge';
import { getPersona } from '../pw/personas';
import { SUPPORT_RESOURCES } from '../pw/safety';

/**
 * The result, recorded — and the point at which the offer gate is consulted.
 *
 * Three outcomes, three genuinely different endings. Two of the three end
 * without anything being sold, which is the part that makes the third one
 * credible.
 */
export const Transformation = () => {
  const session = useSession((s) => s.session);
  const advance = useSession((s) => s.advance);
  const closeWithoutOffer = useSession((s) => s.closeWithoutOffer);
  const reset = useSession((s) => s.reset);
  const decision = useSession((s) => s.offerDecision)();

  if (!session.persona) return null;
  const persona = getPersona(session.persona);

  /* Something changed — the only path on which an offer is permitted. */
  if (decision.allowed) {
    return (
      <div className="px-6 py-14">
        <div className="max-w-xl mx-auto space-y-8">
          <PersonaBadge persona={session.persona} />
          <div className="space-y-5">
            <p className="eyebrow">What just happened</p>
            <h1 className="text-2xl md:text-3xl leading-snug">
              {persona.microTransformation}
            </h1>
            <p className="text-body text-lg">
              That is a small change and it is a real one. You did something and your state moved
              — which means the state was movable, which is most of what anyone needs to know at
              this point.
            </p>
            <p className="text-body">
              Tomorrow the pressure will still be there. The difference is that you now have one
              thing that works on it.
            </p>
          </div>
          <button onClick={() => advance('OFFER')} className="btn-primary inline-flex items-center gap-2">
            What would keep this going?
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    );
  }

  /* Felt worse — stop, hand over resources, sell nothing. */
  if (session.shift === 'worse') {
    return (
      <div className="px-6 py-14">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="space-y-5">
            <h1 className="text-2xl">Then we stop here.</h1>
            <p className="text-body text-lg">
              An exercise that makes things worse is a sign that what you are carrying is heavier
              than a three-minute tool. That is not a failure on your part and it is not something
              to push through.
            </p>
            <p className="text-body">
              Nothing further will be suggested and nothing is being offered to you.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2 text-heading font-semibold">
              <LifeBuoy size={17} style={{ color: 'var(--primary)' }} />
              If you want to talk to a person
            </div>
            {SUPPORT_RESOURCES.map((r) => (
              <div key={r.name} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-body">{r.name}</span>
                <span className="text-primary font-medium whitespace-nowrap">{r.contact}</span>
              </div>
            ))}
          </div>

          <button onClick={reset} className="btn-quiet">
            Start over
          </button>
        </div>
      </div>
    );
  }

  /* The person accepted the honest close. Acknowledge it and stop. */
  if (session.outcome === 'COMPLETED_NO_OFFER') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-14">
        <div className="max-w-md space-y-5 text-center">
          <h1 className="text-2xl">Fair enough.</h1>
          <p className="text-body">
            Nothing is being sent to you and there is nothing to cancel. If a different day feels
            different, this is still here.
          </p>
          <button onClick={reset} className="btn-quiet">
            Start over
          </button>
        </div>
      </div>
    );
  }

  /* Nothing shifted after every exercise we had — close honestly. */
  return (
    <div className="px-6 py-14">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="space-y-5">
          <h1 className="text-2xl">That one didn't land, and that's a real answer.</h1>
          <p className="text-body text-lg">
            You tried {session.attempts} exercise{session.attempts === 1 ? '' : 's'} and nothing
            moved. Rather than sell you a longer version of something that just didn't work, this
            is where it ends.
          </p>
          <p className="text-body">
            What you're dealing with may need a different kind of help than a short exercise, or it
            may just need a different day. Both are allowed.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <button onClick={reset} className="btn-secondary">
            Try describing it differently
          </button>
          <button onClick={closeWithoutOffer} className="btn-quiet">
            That's alright, I'm done
          </button>
        </div>
      </div>
    </div>
  );
};
