import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Volume2, Square } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { isSpeaking, speak, stopSpeaking } from '../lib/speech';

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
      {action}
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  back,
  speakText,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  speakText?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="mb-5 flex items-start gap-3">
      {back && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="press mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-extrabold leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{subtitle}</p>}
      </div>
      {speakText && <SpeakButton text={speakText} />}
    </div>
  );
}

/**
 * Read-aloud control. Present next to every block of text longer than a line —
 * for a low-literacy user this button is the primary way to consume the screen.
 */
export function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  const { lang } = useApp();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (!isSpeaking()) setActive(false);
    }, 400);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => () => stopSpeaking(), []);

  return (
    <button
      type="button"
      aria-label={active ? 'Stop reading' : 'Read aloud'}
      onClick={() => {
        if (active) {
          stopSpeaking();
          setActive(false);
        } else {
          speak(text, lang, { onEnd: () => setActive(false) });
          setActive(true);
        }
      }}
      className={`press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-primary'
      } ${className}`}
    >
      {active ? <Square size={15} fill="currentColor" aria-hidden /> : <Volume2 size={18} aria-hidden />}
    </button>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate font-display text-lg font-bold leading-tight">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * Big, bold, icon-first action tile. Deliberately oversized: the target is a
 * farmer with wet hands looking at a phone in direct sunlight.
 */
export function ActionTile({
  emoji,
  label,
  sublabel,
  onClick,
  tone = 'default',
}: {
  emoji: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
}) {
  const tones = {
    default: 'bg-card border-border',
    primary: 'bg-primary-soft border-[oklch(80%_0.08_152)]',
    danger: 'bg-[oklch(94%_0.04_25)] border-[oklch(84%_0.09_25)]',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press flex flex-col items-start gap-2 rounded-lg border p-4 text-left shadow-glass ${tones[tone]}`}
    >
      <span className="text-3xl leading-none" aria-hidden>
        {emoji}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-bold leading-tight">{label}</span>
        {sublabel && <span className="block text-xs leading-tight text-muted-foreground">{sublabel}</span>}
      </span>
    </button>
  );
}

export function CardSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`solid-card space-y-3 p-4 ${className}`}>
      <div className="skeleton h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${88 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function StaleBadge({ savedAt }: { savedAt: number | null }) {
  if (savedAt === null) return null;
  const mins = Math.round((Date.now() - savedAt) / 60000);
  const when = mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return (
    <span className="rounded-full bg-[oklch(94%_0.08_82)] px-2.5 py-0.5 text-[11px] font-semibold text-[oklch(42%_0.1_70)]">
      Saved · {when}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-border bg-card px-4 py-3 text-base font-medium outline-none transition-shadow focus:ring-2 focus:ring-ring';

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`press flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-4 font-display text-base font-bold text-primary-foreground shadow-glass disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
