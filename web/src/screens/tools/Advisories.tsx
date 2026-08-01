import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { askAgronomist, offlineAnswer } from '../../lib/api';
import { SignalPill } from '../../components/StatusLight';
import { CardSkeleton, ScreenHeader, SpeakButton } from '../../components/ui';

/**
 * Three advisory screens that share one shape: a fixed local baseline the
 * farmer always sees, plus an AI-written note for their specific farm layered
 * on top when the backend is reachable.
 */

type Kind = 'yield' | 'rotation' | 'organic';

const PROMPTS: Record<Kind, (ctx: { crops: string; place: string; acre: number }) => string> = {
  yield: ({ crops, place }) =>
    `Estimate this season's yield for each of these crops in ${place}: ${crops}. Give a per-acre number, the two factors most likely to change it, and one action to protect the estimate. Be concise.`,
  rotation: ({ crops, place, acre }) =>
    `I farm ${acre} acre in ${place} and currently grow ${crops}. Recommend a crop rotation for the next two seasons that improves soil nitrogen and breaks pest cycles. Name specific crops and sowing months.`,
  organic: ({ crops, place }) =>
    `Give me a practical organic input plan for ${crops} in ${place}: compost preparation, one bio-fertiliser, and one botanical pest spray I can make on farm. Include quantities per acre.`,
};

const BASELINE: Record<Kind, { title: string; emoji: string; rows: { label: string; value: string; signal: 'green' | 'yellow' | 'red' }[] }> = {
  yield: {
    title: 'Season baseline',
    emoji: '📈',
    rows: [
      { label: 'Wheat (irrigated)', value: '18–22 qtl/acre', signal: 'green' },
      { label: 'Tomato (hybrid)', value: '70–90 qtl/acre', signal: 'yellow' },
      { label: 'Sugarcane (adsali)', value: '380–450 qtl/acre', signal: 'green' },
      { label: 'Onion (rabi)', value: '100–130 qtl/acre', signal: 'yellow' },
    ],
  },
  rotation: {
    title: 'Proven rotations',
    emoji: '🔄',
    rows: [
      { label: 'Wheat → Moong → Cotton', value: 'Fixes N, breaks bollworm', signal: 'green' },
      { label: 'Rice → Chickpea → Fallow', value: 'Cuts water 40%', signal: 'green' },
      { label: 'Tomato → Tomato', value: 'Builds up wilt — avoid', signal: 'red' },
      { label: 'Sugarcane → Sugarcane', value: 'Ratoon only once', signal: 'yellow' },
    ],
  },
  organic: {
    title: 'On-farm inputs',
    emoji: '♻️',
    rows: [
      { label: 'Jeevamrut', value: '200 L per acre, monthly', signal: 'green' },
      { label: 'Vermicompost', value: '2 tonne per acre', signal: 'green' },
      { label: 'Neem seed extract', value: '5% spray, every 10 days', signal: 'green' },
      { label: 'Trichoderma', value: '2 kg per acre with FYM', signal: 'yellow' },
    ],
  },
};

export function Advisory({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const { profile, crops, lang } = useApp();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const titles: Record<Kind, string> = {
    yield: t('tools.yieldPrediction'),
    rotation: t('tools.cropRotation'),
    organic: t('tools.organicAdvisor'),
  };
  const subs: Record<Kind, string> = {
    yield: t('tools.yieldPredictionSub'),
    rotation: t('tools.cropRotationSub'),
    organic: t('tools.organicAdvisorSub'),
  };

  const question = useMemo(
    () =>
      PROMPTS[kind]({
        crops: crops.map((c) => `${c.name} (${c.areaAcre} acre, ${c.stage})`).join(', ') || 'wheat',
        place: `${profile.district}, ${profile.state}`,
        acre: profile.landAcre,
      }),
    [kind, crops, profile],
  );

  useEffect(() => {
    let alive = true;
    setBusy(true);
    void askAgronomist(question, { profile, crops, history: [], lang })
      .then((r) => alive && setNote(r.answer))
      .catch(() => alive && setNote(offlineAnswer(titles[kind])))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, lang]);

  const base = BASELINE[kind];

  return (
    <div className="space-y-5">
      <ScreenHeader title={titles[kind]} subtitle={subs[kind]} back />

      <section className="solid-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <span className="text-xl" aria-hidden>{base.emoji}</span>
          <h2 className="flex-1 font-display text-lg font-bold">{base.title}</h2>
        </div>
        <div className="divide-y divide-border">
          {base.rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 p-3.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold leading-tight">{r.label}</span>
                <span className="block truncate text-sm text-muted-foreground">{r.value}</span>
              </span>
              <SignalPill signal={r.signal} label={t(`signal.${r.signal}`)} size="sm" />
            </div>
          ))}
        </div>
      </section>

      {busy ? (
        <CardSkeleton lines={5} />
      ) : (
        note && (
          <section className="glass-card p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-base" aria-hidden>
                🌿
              </span>
              <h2 className="flex-1 font-display text-lg font-bold">For your farm</h2>
              <SpeakButton text={note} />
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{note}</p>
          </section>
        )
      )}

      {busy && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden /> {t('assistant.thinking')}
        </p>
      )}
    </div>
  );
}

export const YieldScreen = () => <Advisory kind="yield" />;
export const RotationScreen = () => <Advisory kind="rotation" />;
export const OrganicScreen = () => <Advisory kind="organic" />;
