import { useState } from 'react';
import { allPersonas } from '../pw/personas';
import { getPressure } from '../pw/pressure';
import { interventionForPersona } from '../pw/interventions';
import { CONTENT_CALENDAR, WEEKDAYS, slotsForDay } from '../pw/calendar';
import { MAX_ATTEMPTS, STAGE_LABELS } from '../pw/funnel';
import { useSession } from '../state/sessionStore';
import { PromptStudio } from './PromptStudio';
import { PersonaMark } from '../ui/PersonaBadge';
import { cn } from '../lib/utils';

import { Dice } from '../dice/Dice';

type Tab = 'dice' | 'guides' | 'calendar' | 'prompts' | 'ledger';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dice', label: 'DICE' },
  { id: 'guides', label: 'Guides' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'prompts', label: 'Prompt studio' },
  { id: 'ledger', label: 'Session ledger' },
];

const Guides = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {allPersonas().map((p) => {
      const intervention = interventionForPersona(p.id);
      return (
        <div key={p.id} className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <PersonaMark persona={p.id} size={38} />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-heading">{p.name}</h3>
              <p className="text-xs text-muted">{getPressure(p.pressure).label}</p>
            </div>
          </div>

          <p className="text-sm text-body">{p.fn}</p>

          <div className="text-sm space-y-1.5">
            <div className="flex gap-2">
              <span className="text-muted w-20 shrink-0 text-xs pt-0.5">Signature</span>
              <span className="text-body">{intervention?.name ?? p.signatureMove}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted w-20 shrink-0 text-xs pt-0.5">Result</span>
              <span className="text-body italic">"{p.microTransformation}"</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted w-20 shrink-0 text-xs pt-0.5">Voice</span>
              <span className="text-body">{p.voice.join(', ')}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted w-20 shrink-0 text-xs pt-0.5">Channels</span>
              <span className="text-body">{p.channels.join(' · ')}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted w-20 shrink-0 text-xs pt-0.5">Mailbox</span>
              <span className="text-muted font-mono text-xs pt-0.5 truncate">{p.mailbox}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {p.visual.palette.map((c) => (
              <span key={c} className="w-5 h-5 rounded-md border border-border" style={{ background: c }} />
            ))}
            <span className="text-xs text-muted">{p.visual.symbol} · {p.visual.style}</span>
          </div>
        </div>
      );
    })}
  </div>
);

const Calendar = () => (
  <div className="space-y-4">
    <p className="text-sm text-body prose-measure">
      {CONTENT_CALENDAR.length} slots a week across {new Set(CONTENT_CALENDAR.map((s) => s.channel)).size}{' '}
      channels. One brand account per channel, publishing on a stated cadence — no second accounts
      amplifying the first.
    </p>
    <div className="space-y-3">
      {WEEKDAYS.map((day) => {
        const slots = slotsForDay(day);
        if (slots.length === 0) return null;
        return (
          <div key={day} className="card p-4">
            <div className="eyebrow mb-3">{day}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-muted">
                  <PersonaMark persona={slot.persona} size={22} />
                  <div className="min-w-0">
                    <div className="text-sm text-body truncate">{slot.topic}</div>
                    <div className="text-xs text-muted">{slot.channel} · {slot.format}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const Ledger = () => {
  const session = useSession((s) => s.session);
  const decision = useSession((s) => s.offerDecision)();

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-3">
        <div className="eyebrow">Offer gate</div>
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded-md text-xs font-bold"
            style={{
              background: decision.allowed ? 'rgba(74,124,111,0.14)' : 'var(--primary-dim)',
              color: decision.allowed ? 'var(--calm)' : 'var(--muted)',
            }}
          >
            {decision.allowed ? 'ALLOWED' : 'WITHHELD'}
          </span>
          <span className="text-sm text-body">{decision.reason}</span>
        </div>
        <div className="text-xs text-muted">
          Attempts {session.attempts}/{MAX_ATTEMPTS} · outcome {session.outcome}
          {session.safetyRouted && ' · safety routed'}
        </div>
      </div>

      <div className="space-y-2">
        <div className="eyebrow">Signed events</div>
        {session.events.length === 0 && (
          <p className="text-sm text-muted">No events yet. Run a session and they appear here.</p>
        )}
        {session.events.map((e) => (
          <div key={e.id} className="card p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-heading">{e.kind}</span>
              <span className="text-xs text-muted">{STAGE_LABELS[e.stage]}</span>
            </div>
            <pre className="text-xs text-muted font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(e.detail, null, 1)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Console = ({ onSignOut }: { onSignOut: () => void }) => {
  const [tab, setTab] = useState<Tab>('dice');

  // DICE gets the full width; the reference tabs keep the narrower column.
  if (tab === 'dice') {
    return (
      <div className="space-y-0">
        <div className="max-w-6xl mx-auto px-6 pt-8">
          <Tabs tab={tab} setTab={setTab} />
        </div>
        <Dice onSignOut={onSignOut} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-7">
      <div className="space-y-2">
        <h1 className="text-2xl">Operator console</h1>
        <p className="text-body prose-measure">
          The engine behind the ten front doors: who each guide is, what they publish, how their
          prompts are assembled, and what a session recorded.
        </p>
      </div>

      <Tabs tab={tab} setTab={setTab} />

      {tab === 'guides' && <Guides />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'prompts' && <PromptStudio />}
      {tab === 'ledger' && <Ledger />}
    </div>
  );
};

const Tabs = ({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) => (
  <div className="flex gap-1 border-b border-border overflow-x-auto">
    {TABS.map((t) => (
      <button
        key={t.id}
        onClick={() => setTab(t.id)}
        className={cn(
          'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
          tab === t.id ? 'border-primary text-heading' : 'border-transparent text-muted hover:text-body',
        )}
      >
        {t.label}
      </button>
    ))}
  </div>
);
