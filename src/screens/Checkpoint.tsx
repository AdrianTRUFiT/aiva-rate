import { useSession } from '../state/sessionStore';
import { PersonaBadge } from '../ui/PersonaBadge';
import type { ShiftReport } from '../pw/types';

/**
 * The checkpoint.
 *
 * The three answers are weighted evenly on purpose. This question is the input
 * to the offer gate, so a UI that nudges toward "yes" would corrupt the one
 * measurement the entire commercial model rests on.
 */
const ANSWERS: { value: ShiftReport; label: string; sub: string }[] = [
  { value: 'shifted', label: 'Something shifted', sub: 'Small counts.' },
  { value: 'unchanged', label: 'Honestly, no change', sub: "That's useful to know." },
  { value: 'worse', label: 'I feel worse', sub: 'Then we stop here.' },
];

export const Checkpoint = () => {
  const session = useSession((s) => s.session);
  const reportShift = useSession((s) => s.reportShift);

  if (!session.intervention || !session.persona) return null;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-14">
      <div className="w-full max-w-xl space-y-9">
        <PersonaBadge persona={session.persona} />

        <h1 className="text-2xl md:text-3xl leading-snug">
          {session.intervention.checkpointQuestion}
        </h1>

        <div className="space-y-3">
          {ANSWERS.map((a) => (
            <button
              key={a.value}
              onClick={() => reportShift(a.value)}
              className="card w-full text-left p-5 hover:border-border-hover"
            >
              <div className="font-semibold text-heading">{a.label}</div>
              <div className="text-sm text-muted mt-0.5">{a.sub}</div>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted border-t border-border pt-6">
          Answer it accurately rather than kindly. "No change" leads somewhere different, not
          nowhere.
        </p>
      </div>
    </div>
  );
};
