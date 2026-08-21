import { getPersona } from '../pw/personas';
import type { PersonaId } from '../pw/types';
import { cn } from '../lib/utils';

/**
 * A persona's mark. The symbol and palette come from the visual identity
 * system, so the same guide looks the same wherever they appear.
 */
export const PersonaMark = ({ persona, size = 40 }: { persona: PersonaId; size?: number }) => {
  const { visual, name } = getPersona(persona);
  return (
    <div
      role="img"
      aria-label={`${name} mark`}
      className="shrink-0 rounded-full flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${visual.palette[0]}, ${visual.palette[1]})`,
      }}
    >
      {name.replace('The ', '').charAt(0)}
    </div>
  );
};

export const PersonaBadge = ({
  persona,
  className,
}: {
  persona: PersonaId;
  className?: string;
}) => {
  const p = getPersona(persona);
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <PersonaMark persona={persona} size={36} />
      <div className="min-w-0">
        <div className="font-semibold text-heading text-sm leading-tight">{p.name}</div>
        <div className="text-xs text-muted leading-tight">{p.visual.signal} · AI guide</div>
      </div>
    </div>
  );
};
