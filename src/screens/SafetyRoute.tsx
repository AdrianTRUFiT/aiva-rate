import { LifeBuoy, ExternalLink } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { resourcesFor, ROUTING_MESSAGE } from '../pw/safety';

/**
 * Where the funnel stops.
 *
 * No exercise, no checkpoint, no offer, no "but first". The commercial system
 * is switched off entirely for this session — see evaluateOffer, which refuses
 * on safetyRouted before it checks anything else.
 */
export const SafetyRoute = () => {
  const safety = useSession((s) => s.safety);
  const reset = useSession((s) => s.reset);
  const resources = safety ? resourcesFor(safety) : [];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl space-y-8">
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}
          >
            <LifeBuoy size={22} />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl">{ROUTING_MESSAGE.heading}</h1>
            <p className="text-body">{ROUTING_MESSAGE.body}</p>
          </div>
        </div>

        <div className="space-y-3">
          {resources.map((r) => (
            <div key={r.name} className="card p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-heading">{r.name}</h2>
                  <span className="eyebrow">{r.region}</span>
                </div>
                <p className="text-sm text-body">{r.detail}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-primary text-sm whitespace-nowrap">
                  {r.contact}
                </div>
                {r.contact.includes('.com') && (
                  <a
                    href={`https://${r.contact}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-body mt-1"
                  >
                    Open <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted border-t border-border pt-6">{ROUTING_MESSAGE.close}</p>

        <button onClick={reset} className="btn-quiet">
          Start over
        </button>
      </div>
    </div>
  );
};
