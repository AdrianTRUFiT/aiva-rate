import { SOULHOST } from '../pw/soulhost';
import { cn } from '../lib/utils';

/**
 * The one identity a person sees.
 *
 * The ten guides select the copy and the exercise behind this, and the ledger
 * records which of them did — but they are capabilities, not a cast, and none
 * of them is introduced by name. See src/pw/soulhost.ts.
 */
export const SoulHostMark = ({ size = 34 }: { size?: number }) => (
  <div
    role="img"
    aria-label="SoulHost"
    className="shrink-0 rounded-full"
    style={{
      width: size,
      height: size,
      background: 'linear-gradient(135deg, var(--primary), var(--calm))',
    }}
  />
);

export const SoulHostBadge = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center gap-3', className)}>
    <SoulHostMark />
    <div>
      <div className="font-semibold text-heading text-sm leading-tight">{SOULHOST.name}</div>
      <div className="text-xs text-muted leading-tight">AI guide</div>
    </div>
  </div>
);

/**
 * Standing AI disclosure. Present on every screen where SoulHost speaks, not
 * tucked into a footer — the voice is designed to feel human, which is exactly
 * why this cannot be subtle.
 */
export const Disclosure = () => (
  <p className="text-xs text-muted">{SOULHOST.disclosure}</p>
);
