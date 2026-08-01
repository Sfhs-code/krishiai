import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { matchSchemes } from '../../lib/api';
import { DEMO_SCHEMES } from '../../lib/demoData';
import type { Scheme } from '../../lib/types';
import { SignalPill } from '../../components/StatusLight';
import { CardSkeleton, ScreenHeader, SpeakButton } from '../../components/ui';

export default function Schemes() {
  const { t } = useTranslation();
  const { profile, crops, lang } = useApp();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void matchSchemes({ profile, crops: crops.map((c) => c.name), lang })
      .then((res) => alive && setSchemes(res.data))
      .catch(() => alive && setSchemes(DEMO_SCHEMES))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [profile, crops, lang]);

  const eligible = schemes.filter((s) => s.eligible);
  const rest = schemes.filter((s) => !s.eligible);

  const summary = eligible.map((s) => `${s.name}. ${s.benefit}. ${s.reason}`).join(' ');

  const card = (s: Scheme) => {
    const expanded = open === s.id;
    return (
      <article key={s.id} className="solid-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(expanded ? null : s.id)}
          aria-expanded={expanded}
          className="flex w-full items-start gap-3 p-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight">{s.name}</p>
            <p className="text-sm text-muted-foreground">{s.nameHi}</p>
            <p className="mt-1.5 font-display text-lg font-extrabold text-primary">{s.benefit}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <SignalPill
              signal={s.eligible ? 'green' : 'red'}
              label={s.eligible ? t('tools.eligible') : t('tools.notEligible')}
              size="sm"
            />
            <ChevronDown
              size={16}
              className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </div>
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-border bg-muted/40 p-4">
            <div className="flex items-start gap-2">
              <p className="flex-1 text-[15px] leading-snug">{s.reason}</p>
              <SpeakButton text={`${s.name}. ${s.benefit}. ${s.reason}`} />
            </div>

            {s.deadline && (
              <p className="rounded-md bg-[oklch(94%_0.08_82)] px-3 py-2 text-sm font-semibold text-[oklch(42%_0.1_70)]">
                ⏰ Last date: {s.deadline}
              </p>
            )}

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('tools.documents')}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {s.documents.map((d) => (
                  <li key={d} className="rounded-full bg-card px-3 py-1 text-xs font-medium">
                    📄 {d}
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={s.applyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="press flex items-center justify-center gap-2 rounded-md bg-primary py-3 font-bold text-primary-foreground"
            >
              {t('tools.apply')} <ExternalLink size={15} aria-hidden />
            </a>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-5">
      <ScreenHeader
        title={t('tools.govtSchemes')}
        subtitle={`${profile.district}, ${profile.state}`}
        back
        speakText={summary}
      />

      {loading && schemes.length === 0 ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <CardSkeleton key={i} lines={2} />)}</div>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold">
              ✅ {t('tools.eligible')} ({eligible.length})
            </h2>
            {eligible.map(card)}
          </div>
          {rest.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-bold text-muted-foreground">
                {t('tools.notEligible')} ({rest.length})
              </h2>
              {rest.map(card)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
