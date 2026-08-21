import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Navbar, type View } from './ui/Navbar';
import { SessionFlow } from './ui/SessionFlow';
import { Week } from './screens/Week';
import { Console } from './console/Console';
import { OperatorGate } from './dice/OperatorGate';
import { awaitActivation, useWeek } from './state/weekStore';

/**
 * Two products in one shell.
 *
 * An anonymous session that never leaves the browser, and — for anyone who
 * enrolled — a paid week served from the server. On boot the week is checked
 * first, because a returning person on day 4 should land in their week, not at
 * a threshold question they already answered.
 */
export default function App() {
  const [view, setView] = useState<View>('session');
  const { phase, hydrate, view: week } = useWeek();
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Returning from checkout: the webhook activates the week and can land a
  // beat after the browser redirect, so poll briefly rather than assume.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('enrolled')) return;
    window.history.replaceState({}, '', window.location.pathname);
    setActivating(true);
    void awaitActivation().finally(() => setActivating(false));
  }, []);

  const inWeek = phase === 'active' && week !== null && week.status !== 'pending_payment';
  // Payment taken, webhook not landed yet. Without this branch a paying person
  // falls through to the threshold question they already answered.
  const awaitingWebhook = phase === 'active' && week?.status === 'pending_payment' && !activating;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar view={view} onView={setView} inWeek={inWeek} />
      <main className="flex-grow">
        {view === 'console' ? (
          <OperatorGate>{(signOut) => <Console onSignOut={signOut} />}</OperatorGate>
        ) : phase === 'loading' || activating ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-muted">
            <Loader2 size={20} className="animate-spin" />
            {activating && <p className="text-sm">Confirming your payment…</p>}
          </div>
        ) : inWeek ? (
          <Week />
        ) : awaitingWebhook ? (
          <div className="min-h-[60vh] flex items-center justify-center px-6">
            <div className="max-w-md space-y-5 text-center">
              <h1 className="text-2xl">Your payment is still confirming.</h1>
              <p className="text-body">
                This usually takes a few seconds. Your week starts the moment it lands, and the
                first email will arrive either way — nothing is lost if you close this.
              </p>
              <button
                onClick={() => {
                  setActivating(true);
                  void awaitActivation().finally(() => setActivating(false));
                }}
                className="btn-secondary"
              >
                Check again
              </button>
            </div>
          </div>
        ) : (
          <SessionFlow />
        )}
      </main>
      <footer className="py-8 px-6 border-t border-border">
        <p className="max-w-5xl mx-auto text-xs text-muted">
          Performance Wellness is not therapy, counselling, or medical care. Every guide is an AI.
          If you are in crisis, contact your local emergency number or a crisis line —{' '}
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-body"
          >
            findahelpline.com
          </a>{' '}
          lists them by country.
        </p>
      </footer>
    </div>
  );
}
