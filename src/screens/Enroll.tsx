import { useState } from 'react';
import { ArrowRight, Loader2, Lock } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { ApiError, enroll } from '../services/api';
import { RESET_OFFER } from '../pw/continuity';

/**
 * Enrolment — the first moment anything leaves the browser.
 *
 * That is stated here rather than buried, because the threshold screen
 * promised the opposite and the promise has to be retired explicitly at the
 * point it stops being true.
 */
export const Enroll = ({ onBack }: { onBack: () => void }) => {
  const session = useSession((s) => s.session);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);

    try {
      const { checkoutUrl } = await enroll({
        email: email.trim(),
        pressure: session.pressure!,
        persona: session.persona!,
        intervention: session.intervention!.id,
        evidence: {
          interventionCompleted: session.interventionCompleted,
          shift: session.shift,
          attempts: session.attempts,
          safetyRouted: session.safetyRouted,
        },
      });
      window.location.assign(checkoutUrl);
    } catch (err) {
      // A gate refusal is not a network problem and should not read like one.
      setError(
        err instanceof ApiError && err.gate
          ? `This week isn't available for this session. ${err.gate}`
          : (err as Error).message,
      );
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-14">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="space-y-3">
          <p className="eyebrow">One detail</p>
          <h1 className="text-2xl">Where should the daily message go?</h1>
          <p className="text-body">
            Each morning brings one exercise and one question. No password and no account — the
            link in the email is all you need, from any device.
          </p>
        </div>

        <div className="space-y-4">
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            className="input-field text-[16px]"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={busy}
          />

          {error && (
            <p className="text-sm" style={{ color: 'var(--critical)' }}>
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-5">
            <button onClick={submit} disabled={!email.trim() || busy} className="btn-primary inline-flex items-center gap-2">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Lock size={16} />}
              {busy ? 'Opening checkout…' : 'Continue to payment'}
              {!busy && <ArrowRight size={16} />}
            </button>
            <button onClick={onBack} className="btn-quiet" disabled={busy}>
              Back
            </button>
          </div>
        </div>

        {/* The threshold screen promised nothing leaves the browser. It is about
            to, so say so plainly rather than letting the earlier promise stand. */}
        <div className="card p-5 space-y-2">
          <p className="eyebrow">What gets stored, now that you're enrolling</p>
          <ul className="text-sm text-body space-y-1.5">
            <li>· Your email address, so the daily message can reach you.</li>
            <li>· Which door you came through and which exercise worked — not the words you typed.</li>
            <li>· Anything you write at a daily check-in, kept so you can read it back.</li>
          </ul>
          <p className="text-xs text-muted pt-1">
            {RESET_OFFER.commitments[3]} Payment is handled by the payment processor; card details
            never reach this app.
          </p>
        </div>
      </div>
    </div>
  );
};
