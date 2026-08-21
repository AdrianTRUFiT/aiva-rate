import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { allPersonas, getPersona } from '../pw/personas';
import { PRESSURE_MOMENTS, PRESSURE_ORDER } from '../pw/pressure';
import { interventionForPersona } from '../pw/interventions';
import { buildPrompt } from '../pw/promptEngine';
import type { Channel, ContentFormat, PersonaId, PressureId } from '../pw/types';

const FORMATS: ContentFormat[] = ['long-form', 'short-form', 'carousel', 'thread', 'article', 'check-in'];

/**
 * Assembles the persona prompt an operator uses to draft content.
 *
 * It builds the brief; a human still reviews what comes back. Nothing here
 * posts anything anywhere — see docs/performance-wellness/distribution-policy.md.
 */
export const PromptStudio = () => {
  const [persona, setPersona] = useState<PersonaId>('stabilizer');
  const [pressure, setPressure] = useState<PressureId>('sudden-shock');
  const [channel, setChannel] = useState<Channel>('youtube');
  const [format, setFormat] = useState<ContentFormat>('short-form');
  const [statement, setStatement] = useState('I just got laid off and I have no idea what to do.');
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(
    () =>
      buildPrompt(
        { persona, pressure, statement, channel, format, variants: 3 },
        interventionForPersona(persona),
      ),
    [persona, pressure, statement, channel, format],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is unavailable in some embedded contexts; the textarea below
      // is always selectable as a fallback.
      setCopied(false);
    }
  };

  const field = 'input-field text-sm py-2.5';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="ps-persona">Guide</label>
          <select id="ps-persona" className={field} value={persona}
            onChange={(e) => {
              const id = e.target.value as PersonaId;
              setPersona(id);
              setPressure(getPersona(id).pressure);
            }}>
            {allPersonas().map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="ps-pressure">Front door</label>
          <select id="ps-pressure" className={field} value={pressure}
            onChange={(e) => setPressure(e.target.value as PressureId)}>
            {PRESSURE_ORDER.map((id) => (
              <option key={id} value={id}>{PRESSURE_MOMENTS[id].label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="ps-channel">Channel</label>
          <select id="ps-channel" className={field} value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}>
            {getPersona(persona).channels.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="ps-format">Format</label>
          <select id="ps-format" className={field} value={format}
            onChange={(e) => setFormat(e.target.value as ContentFormat)}>
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="eyebrow" htmlFor="ps-statement">Pressure statement</label>
          <textarea id="ps-statement" className={`${field} min-h-[90px] resize-none`}
            value={statement} onChange={(e) => setStatement(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Assembled prompt</span>
          <button onClick={copy} className="btn-quiet inline-flex items-center gap-1.5 no-underline">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="card p-5 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto text-body font-mono">
          {prompt}
        </pre>
      </div>
    </div>
  );
};
