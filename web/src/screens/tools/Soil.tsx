import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import { loadSoil } from '../../lib/api';
import { DEMO_SOIL } from '../../lib/demoData';
import type { SoilReading, Signal } from '../../lib/types';
import { SIGNAL_STYLES, SignalPill } from '../../components/StatusLight';
import { CardSkeleton, ScreenHeader, SpeakButton } from '../../components/ui';

const RANGES: Record<string, { min: number; max: number; unit: string }> = {
  nitrogen: { min: 0, max: 600, unit: 'kg/ha' },
  phosphorus: { min: 0, max: 60, unit: 'kg/ha' },
  potassium: { min: 0, max: 400, unit: 'kg/ha' },
  ph: { min: 3, max: 10, unit: '' },
  organicCarbon: { min: 0, max: 1.5, unit: '%' },
};

export default function Soil() {
  const { t } = useTranslation();
  const { profile } = useApp();
  const [soil, setSoil] = useState<SoilReading | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadSoil(profile.lat, profile.lon)
      .then((r) => alive && setSoil(r.data))
      .catch(() => alive && setSoil(DEMO_SOIL))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [profile.lat, profile.lon]);

  const rows = soil
    ? ([
        ['nitrogen', t('soil.nitrogen'), soil.nitrogen],
        ['phosphorus', t('soil.phosphorus'), soil.phosphorus],
        ['potassium', t('soil.potassium'), soil.potassium],
        ['ph', t('soil.ph'), soil.ph],
        ['organicCarbon', t('soil.organicCarbon'), soil.organicCarbon],
      ] as [string, string, { value: number; signal: Signal; label: string }][])
    : [];

  const summary = soil
    ? `${rows.map(([, label, v]) => `${label} is ${v.label}`).join('. ')}. ${soil.advice.join(' ')}`
    : '';

  return (
    <div className="space-y-5">
      <ScreenHeader
        title={t('soil.title')}
        subtitle={`${profile.village}, ${profile.district} · ${profile.soilType}`}
        back
        speakText={summary}
      />

      {loading && !soil ? (
        <CardSkeleton lines={5} />
      ) : soil ? (
        <>
          <section className="solid-card divide-y divide-border">
            {rows.map(([key, label, v]) => {
              const range = RANGES[key];
              const pct = Math.max(4, Math.min(100, ((v.value - range.min) / (range.max - range.min)) * 100));
              const s = SIGNAL_STYLES[v.signal];
              return (
                <div key={key} className="p-4">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="flex-1 font-semibold">{label}</span>
                    <span className="font-display text-lg font-bold">
                      {v.value}
                      <span className="ml-0.5 text-xs font-medium text-muted-foreground">{range.unit}</span>
                    </span>
                    <SignalPill signal={v.signal} label={v.label} size="sm" />
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </section>

          <section className="solid-card p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="text-xl" aria-hidden>📋</span>
              <h2 className="flex-1 font-display text-lg font-bold">{t('soil.advice')}</h2>
              <SpeakButton text={soil.advice.join('. ')} />
            </div>
            <ol className="space-y-2.5">
              {soil.advice.map((a, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-[15px] leading-snug">{a}</span>
                </li>
              ))}
            </ol>
          </section>

          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Values are modelled from your location and the national soil grid. For a certified reading, apply for a free
            Soil Health Card — it is listed under Government schemes.
          </p>
        </>
      ) : null}
    </div>
  );
}
