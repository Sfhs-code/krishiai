import type { Signal } from '../lib/types';

/**
 * The traffic-light system, in one place.
 *
 * GREEN  = verified authentic / normal mandi operations / crop healthy
 * YELLOW = caution — high wait times, product under review, watch this crop
 * RED    = counterfeit confirmed / mandi congested (divert now) / crop at risk
 *
 * Colour is never the only cue: every variant also carries a distinct shape
 * and a text label, because colour-blind farmers and bright sunlight are both
 * real conditions in the field.
 */

export const SIGNAL_STYLES: Record<Signal, { bg: string; fg: string; ring: string; dot: string; glyph: string }> = {
  green: {
    bg: 'bg-[oklch(93%_0.06_150)]',
    fg: 'text-[oklch(38%_0.11_152)]',
    ring: 'ring-[oklch(70%_0.12_152)]',
    dot: 'bg-[oklch(58%_0.15_152)]',
    glyph: '●',
  },
  yellow: {
    bg: 'bg-[oklch(94%_0.08_82)]',
    fg: 'text-[oklch(42%_0.1_70)]',
    ring: 'ring-[oklch(78%_0.13_78)]',
    dot: 'bg-[oklch(75%_0.14_75)]',
    glyph: '▲',
  },
  red: {
    bg: 'bg-[oklch(93%_0.05_25)]',
    fg: 'text-[oklch(45%_0.17_25)]',
    ring: 'ring-[oklch(70%_0.17_25)]',
    dot: 'bg-[oklch(58%_0.2_22)]',
    glyph: '■',
  },
};

export function SignalDot({ signal, size = 10 }: { signal: Signal; size?: number }) {
  const s = SIGNAL_STYLES[signal];
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className={`absolute inset-0 rounded-full ${s.dot}`} />
      {signal === 'red' && <span className={`absolute inset-0 rounded-full ${s.dot} animate-pulse-ring`} />}
    </span>
  );
}

export function SignalPill({
  signal,
  label,
  className = '',
  size = 'md',
}: {
  signal: Signal;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const s = SIGNAL_STYLES[signal];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${s.bg} ${s.fg} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${className}`}
    >
      <span aria-hidden className="text-[9px] leading-none">
        {s.glyph}
      </span>
      {label}
    </span>
  );
}

/** Full-width banner used for high-stakes verdicts (counterfeit, congestion). */
export function SignalBanner({
  signal,
  title,
  detail,
  action,
}: {
  signal: Signal;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  const s = SIGNAL_STYLES[signal];
  return (
    <div className={`rounded-lg p-4 ring-2 ${s.bg} ${s.ring}`} role={signal === 'red' ? 'alert' : 'status'}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.dot} text-white`}>
          <span aria-hidden className="text-sm">
            {s.glyph}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-display text-lg font-bold leading-tight ${s.fg}`}>{title}</p>
          {detail && <p className={`mt-1 text-sm leading-snug ${s.fg} opacity-90`}>{detail}</p>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
