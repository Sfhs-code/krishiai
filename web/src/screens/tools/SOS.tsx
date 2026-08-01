import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, MapPin } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { HELPLINES } from '../../lib/demoData';
import { ScreenHeader } from '../../components/ui';

export default function SOS() {
  const { t } = useTranslation();
  const { profile, say } = useApp();

  // Announce the screen the moment it opens — in an emergency the user may not
  // be able to read.
  useEffect(() => {
    say('Emergency help. Tap any number to call. Kisan Call Centre is one eight zero zero, one eight zero, one five five one.', {
      force: true,
    });
  }, [say]);

  const shareLocation = () => {
    const url = `https://maps.google.com/?q=${profile.lat},${profile.lon}`;
    const text = `Emergency at my farm. Location: ${url} (${profile.village}, ${profile.district}, ${profile.state})`;
    if (navigator.share) {
      void navigator.share({ text }).catch(() => undefined);
    } else {
      void navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('sosScreen.title')} subtitle={t('sosScreen.subtitle')} back />

      <div className="space-y-3">
        {HELPLINES.map((h) => (
          <a
            key={h.id}
            href={`tel:${h.number}`}
            className="press flex items-center gap-3.5 rounded-lg border-2 border-[oklch(84%_0.09_25)] bg-[oklch(94%_0.04_25)] p-4 shadow-glass"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl" aria-hidden>
              {h.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-bold leading-tight">{h.label}</span>
              <span className="block font-display text-xl font-extrabold tabular-nums leading-tight text-destructive">
                {h.number}
              </span>
              <span className="block text-xs text-muted-foreground">{h.note}</span>
            </span>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <Phone size={20} aria-hidden />
            </span>
          </a>
        ))}
      </div>

      <button
        type="button"
        onClick={shareLocation}
        className="press flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-4 font-display font-bold"
      >
        <MapPin size={18} aria-hidden /> Share my location
      </button>

      <p className="px-1 text-center text-xs leading-relaxed text-muted-foreground">
        These numbers work without internet. Calling opens your phone dialler.
      </p>
    </div>
  );
}
