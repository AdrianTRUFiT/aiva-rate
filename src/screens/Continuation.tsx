import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useSession } from '../state/sessionStore';
import { buildResetPlan } from '../pw/continuity';
import { getPersona } from '../pw/personas';
import { PersonaMark } from '../ui/PersonaBadge';
import { cn } from '../lib/utils';

/**
 * Continuation — the retention engine, run by the Continuity Guide.
 *
 * The recurring value is not more content. It is the daily minute that keeps
 * the thread attached once the original pressure fades and nothing has replaced
 * it. Days open in order; there is nothing to binge.
 */
export const Continuation = () => {
  const session = useSession((s) => s.session);
  const reset = useSession((s) => s.reset);
  const [done, setDone] = useState<number[]>([]);
  const [note, setNote] = useState('');

  const plan = useMemo(
    () => (session.pressure ? buildResetPlan(session.pressure) : []),
    [session.pressure],
  );

  const today = plan.find((d) => !done.includes(d.day)) ?? plan[plan.length - 1];
  const complete = done.length === plan.length;

  if (!today) return null;

  return (
    <div className="px-6 py-14">
      <div className="max-w-xl mx-auto space-y-9">
        <div className="space-y-3">
          <p className="eyebrow">7-Day Under Pressure Reset</p>
          <h1 className="text-2xl">
            {complete ? 'That was the week.' : `Day ${today.day} · ${today.intervention.name}`}
          </h1>
          <p className="text-body">
            {complete
              ? 'Seven days, seven small things. Nothing renews and nothing needs cancelling — if it was useful, you know where this is.'
              : today.focus}
          </p>
        </div>

        {!complete && (
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-3">
              <PersonaMark persona={today.persona} size={32} />
              <div>
                <div className="text-sm font-semibold text-heading">
                  {getPersona(today.persona).name}
                </div>
                <div className="text-xs text-muted">Today's one-minute check-in</div>
              </div>
            </div>

            <p className="text-heading text-lg leading-snug">{today.checkIn}</p>

            <textarea
              className="input-field min-h-[90px] resize-none"
              placeholder="A sentence is enough…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button
              onClick={() => {
                setDone([...done, today.day]);
                setNote('');
              }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Check size={17} />
              Log it
            </button>
          </div>
        )}

        <div className="space-y-2">
          {plan.map((day) => {
            const isDone = done.includes(day.day);
            const isToday = !complete && day.day === today.day;
            return (
              <div
                key={day.day}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
                  isToday ? 'border-primary bg-primary-dim' : 'border-transparent bg-surface-muted',
                  isDone && 'opacity-55',
                )}
              >
                <span className="text-xs text-muted tabular-nums w-11 shrink-0">Day {day.day}</span>
                <PersonaMark persona={day.persona} size={22} />
                <span className="text-sm text-body truncate">{day.intervention.name}</span>
                {isDone && <Check size={15} className="ml-auto shrink-0" style={{ color: 'var(--calm)' }} />}
              </div>
            );
          })}
        </div>

        <button onClick={reset} className="btn-quiet">
          Start a new session
        </button>
      </div>
    </div>
  );
};
