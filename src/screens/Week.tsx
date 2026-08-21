import { useEffect, useState } from 'react';
import { Check, LifeBuoy, Loader2, Lock } from 'lucide-react';
import { useWeek } from '../state/weekStore';
import { SoulHostBadge, Disclosure } from '../ui/SoulHost';
import { SUPPORT_RESOURCES } from '../pw/safety';
import { SOULHOST } from '../pw/soulhost';
import { cn } from '../lib/utils';

/**
 * A paid week in progress, served from the enrolment rather than the browser.
 *
 * This is the screen that has to work on day 4 on a different device with the
 * tab long since closed. Everything it shows is derived server-side from the
 * enrolment's start time, so a stale client cannot unlock a day early or lose
 * one.
 */

const relative = (iso: string | null, serverNow: string): string => {
  if (!iso) return '';
  const hours = Math.round((new Date(iso).getTime() - new Date(serverNow).getTime()) / 3_600_000);
  if (hours <= 0) return 'now';
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'}`;
};

export const Week = () => {
  const { view, today, routedToSupport, checkIn, refreshToday } = useWeek();
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (view?.status === 'active' && !today) void refreshToday();
  }, [view?.status, today, refreshToday]);

  if (!view) return null;

  /* A check-in tripped the safety screen. Delivery is already paused. */
  if (routedToSupport || view.status === 'paused_safety') {
    return (
      <div className="px-6 py-14">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="flex items-start gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}
            >
              <LifeBuoy size={22} />
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl">I've paused the daily messages.</h1>
              <p className="text-body">
                What you wrote needs a person, not an automated guide. Nothing further will be sent
                and nothing is being asked of you.
              </p>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            {SUPPORT_RESOURCES.map((r) => (
              <div key={r.name} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-body">{r.name}</span>
                <span className="text-primary font-medium whitespace-nowrap">{r.contact}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted border-t border-border pt-6">
            Your week is still here whenever you want it. It will not restart on its own.
          </p>
        </div>
      </div>
    );
  }

  const complete = view.status === 'completed';
  const loggedToday = today ? view.completedDays.includes(today.day) : false;

  return (
    <div className="px-6 py-14">
      <div className="max-w-xl mx-auto space-y-9">
        <div className="flex items-center justify-between gap-4">
          <SoulHostBadge />
          <span className="text-xs text-muted tabular-nums">
            {view.completedDays.length} of {view.plan.length} logged
          </span>
        </div>

        {complete ? (
          <div className="space-y-4">
            <h1 className="text-2xl">That was the week.</h1>
            <p className="text-body text-lg">
              Seven days, seven small things. Nothing renews and there is nothing to cancel. If it
              was useful, you know where this is.
            </p>
          </div>
        ) : today ? (
          <>
            <div className="space-y-3">
              <p className="eyebrow">{SOULHOST.daily(today.day)}</p>
              <h1 className="text-2xl">{today.name}</h1>
              <p className="text-body">{today.premise}</p>
            </div>

            <div className="card p-5">
              <ol className="space-y-2.5">
                {today.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-muted tabular-nums shrink-0">{i + 1}.</span>
                    <span className="text-body">
                      {step.instruction}
                      {step.detail && <span className="block text-muted mt-0.5">{step.detail}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {loggedToday ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--calm)' }}>
                <Check size={16} />
                Logged for today. Next one opens {relative(view.nextUnlocksAt, view.now)}.
              </div>
            ) : (
              <div className="card p-6 space-y-5">
                <p className="text-heading text-lg leading-snug">{today.checkIn}</p>

                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rate today out of ten">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      aria-pressed={rating === n}
                      className={cn(
                        'w-8 h-8 rounded-lg text-sm tabular-nums transition-colors',
                        rating === n
                          ? 'text-white'
                          : 'bg-surface-muted text-muted hover:text-body',
                      )}
                      style={rating === n ? { background: 'var(--primary)' } : undefined}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <textarea
                  className="input-field min-h-[90px] resize-none"
                  placeholder="A sentence is enough…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                <button
                  onClick={async () => {
                    setSaving(true);
                    await checkIn(today.day, rating, note);
                    setNote('');
                    setRating(null);
                    setSaving(false);
                  }}
                  disabled={saving}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
                  Log it
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" />
            Loading today…
          </div>
        )}

        <div className="space-y-2">
          {view.plan.map((day) => {
            const done = view.completedDays.includes(day.day);
            const isToday = !complete && day.day === view.currentDay;
            return (
              <div
                key={day.day}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
                  isToday ? 'border-primary bg-primary-dim' : 'border-transparent bg-surface-muted',
                  day.locked && 'opacity-45',
                )}
              >
                <span className="text-xs text-muted tabular-nums w-11 shrink-0">Day {day.day}</span>
                <span className="text-sm text-body truncate">{day.intervention}</span>
                {day.locked && <Lock size={13} className="ml-auto shrink-0 text-muted" />}
                {done && <Check size={15} className="ml-auto shrink-0" style={{ color: 'var(--calm)' }} />}
              </div>
            );
          })}
        </div>

        {!complete && view.nextUnlocksAt && (
          <p className="text-xs text-muted">
            Day {(view.currentDay ?? 0) + 1} opens {relative(view.nextUnlocksAt, view.now)}. Missing a day is
            not a relapse.
          </p>
        )}

        <div className="pt-6 border-t border-border">
          <Disclosure />
        </div>
      </div>
    </div>
  );
};
