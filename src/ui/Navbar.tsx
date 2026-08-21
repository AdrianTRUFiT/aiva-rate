import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';

export type View = 'session' | 'console';

export const Navbar = ({
  view,
  onView,
  inWeek = false,
}: {
  view: View;
  onView: (v: View) => void;
  /** Relabels the session tab when a paid week is in progress. */
  inWeek?: boolean;
}) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <nav className="border-b border-border bg-surface/85 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-15 py-3 flex items-center justify-between gap-4">
        <button onClick={() => onView('session')} className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-7 h-7 rounded-full shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--calm))' }}
          />
          <span className="font-semibold text-heading tracking-tight truncate">
            Performance Wellness
          </span>
        </button>

        <div className="flex items-center gap-1">
          {(['session', 'console'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => onView(v)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize',
                view === v ? 'text-heading bg-surface-muted' : 'text-muted hover:text-body',
              )}
            >
              {v === 'session' && inWeek ? 'my week' : v}
            </button>
          ))}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-full text-muted hover:text-body hover:bg-surface-muted transition-colors ml-1"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </nav>
  );
};
