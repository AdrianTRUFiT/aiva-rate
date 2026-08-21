import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import * as api from './api';

/**
 * Sign-in for the operator area.
 *
 * Until now the persona console was a tab anyone who loaded the app could
 * click. It now holds ten Reddit identities and a lead pipeline, so it sits
 * behind this. One shared password is modest by design — a real identity
 * provider is the right answer once more than a few people use it — but the
 * area is never open.
 */
export const OperatorGate = ({ children }: { children: (signOut: () => void) => React.ReactNode }) => {
  const [state, setState] = useState<'checking' | 'out' | 'in'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then(() => setState('in')).catch(() => setState('out'));
  }, []);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      setPassword('');
      setState('in');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    void api.logout().finally(() => setState('out'));
  };

  if (state === 'checking') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (state === 'in') return <>{children(signOut)}</>;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-heading">
            <Lock size={17} />
            <h1 className="text-xl">Operator sign-in</h1>
          </div>
          <p className="text-sm text-body">
            This area holds the desk accounts and the opportunity pipeline.
          </p>
        </div>

        <div className="space-y-3">
          <label htmlFor="operator-password" className="sr-only">
            Operator password
          </label>
          <input
            id="operator-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={busy}
          />
          {error && (
            <p className="text-sm" style={{ color: 'var(--critical)' }}>
              {error}
            </p>
          )}
          <button onClick={submit} disabled={!password || busy} className="btn-primary w-full">
            {busy ? 'Checking…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};
