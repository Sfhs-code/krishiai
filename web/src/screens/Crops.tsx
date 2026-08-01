import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, ScanLine, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { Crop, Signal } from '../lib/types';
import { Reveal } from '../components/Reveal';
import { SignalDot, SignalPill } from '../components/StatusLight';
import { Sheet } from '../components/Sheet';
import { ActionTile, Field, PrimaryButton, ScreenHeader, SectionTitle, SpeakButton, inputClass } from '../components/ui';

const STAGES = ['Sowing', 'Germination', 'Vegetative growth', 'Flowering', 'Fruiting', 'Harvest ready'];
const CROP_LIBRARY = [
  { name: 'Wheat', emoji: '🌾' }, { name: 'Rice', emoji: '🌾' }, { name: 'Tomato', emoji: '🍅' },
  { name: 'Onion', emoji: '🧅' }, { name: 'Cotton', emoji: '🪴' }, { name: 'Sugarcane', emoji: '🎋' },
  { name: 'Soybean', emoji: '🫘' }, { name: 'Gram', emoji: '🌰' }, { name: 'Maize', emoji: '🌽' },
  { name: 'Potato', emoji: '🥔' }, { name: 'Chilli', emoji: '🌶️' }, { name: 'Banana', emoji: '🍌' },
];

function statusLabel(signal: Signal, t: (k: string) => string): string {
  return signal === 'green' ? t('crops.healthy') : signal === 'red' ? t('crops.atRisk') : t('crops.watch');
}

function AddCropSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (c: Crop) => void }) {
  const { t } = useTranslation();
  const [pick, setPick] = useState(CROP_LIBRARY[0]);
  const [area, setArea] = useState('1');
  const [stage, setStage] = useState(STAGES[2]);

  return (
    <Sheet onClose={onClose} label={t('crops.addCrop')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{t('crops.addCrop')}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="press rounded-full border border-border p-2">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          {CROP_LIBRARY.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setPick(c)}
              className={`press flex flex-col items-center gap-1 rounded-md border-2 py-3 ${
                pick.name === c.name ? 'border-primary bg-primary-soft' : 'border-border'
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>{c.emoji}</span>
              <span className="text-[10px] font-semibold leading-none">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <Field label={t('crops.area')}>
            <input className={inputClass} type="number" inputMode="decimal" min="0.1" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
          <Field label={t('crops.stage')}>
            <select className={inputClass} value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <PrimaryButton
            onClick={() => {
              onAdd({
                id: `${pick.name.toLowerCase()}-${Date.now()}`,
                name: pick.name,
                emoji: pick.emoji,
                areaAcre: Number(area) || 1,
                stage,
                signal: 'green',
                status: 'Healthy',
                nextAction: 'Check soil moisture',
                nextActionIn: 'in 2 days',
                sownOn: new Date().toISOString().slice(0, 10),
                expectedYieldQtl: Math.round((Number(area) || 1) * 18),
                yieldTrend: 0,
              });
              onClose();
            }}
          >
            <Plus size={18} aria-hidden /> {t('crops.addCrop')}
          </PrimaryButton>
        </div>
    </Sheet>
  );
}

export default function Crops() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { crops, setCrops } = useApp();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const summary = crops
    .map((c) => `${c.name}, ${c.areaAcre} acre, ${c.stage}, ${statusLabel(c.signal, t)}. Next: ${c.nextAction} ${c.nextActionIn}.`)
    .join(' ');

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('crops.title')} subtitle={t('crops.subtitle')} speakText={summary} />

      <Reveal>
        <button
          type="button"
          onClick={() => navigate('/tools/disease')}
          className="press flex w-full items-center gap-4 rounded-lg bg-leaf p-4 text-left text-white shadow-float"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
            <ScanLine size={24} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold leading-tight">{t('crops.scanLeaf')}</span>
            <span className="block text-sm leading-snug text-white/85">{t('disease.instruction')}</span>
          </span>
        </button>
      </Reveal>

      <div className="space-y-3">
        {crops.map((c, i) => {
          const expanded = open === c.id;
          return (
            <Reveal key={c.id} delay={i * 50}>
              <article className="solid-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : c.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3.5 p-4 text-left"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary-soft text-3xl" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-display text-lg font-bold leading-tight">{c.name}</span>
                      <SignalDot signal={c.signal} />
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {t('crops.acres', { n: c.areaAcre })} · {c.stage}
                    </span>
                  </span>
                  <SignalPill signal={c.signal} label={statusLabel(c.signal, t)} size="sm" />
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-border bg-muted/40 p-4">
                    <div className="flex items-start gap-3 rounded-md bg-card p-3">
                      <span className="text-xl" aria-hidden>📌</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('crops.nextAction')}
                        </p>
                        <p className="font-semibold leading-tight">{c.nextAction}</p>
                        <p className="text-sm text-muted-foreground">{c.nextActionIn}</p>
                      </div>
                      <SpeakButton text={`${c.name}. ${c.nextAction}, ${c.nextActionIn}`} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-card p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('crops.expectedYield')}
                        </p>
                        <p className="flex items-center gap-1.5 font-display text-lg font-bold">
                          {c.expectedYieldQtl} qtl
                          {c.yieldTrend !== 0 && (
                            <span className={`flex items-center text-xs font-bold ${c.yieldTrend > 0 ? 'text-primary' : 'text-destructive'}`}>
                              {c.yieldTrend > 0 ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
                              {Math.abs(c.yieldTrend)}%
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-md bg-card p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sown</p>
                        <p className="font-display text-lg font-bold">
                          {new Date(c.sownOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/tools/disease', { state: { cropHint: c.name } })}
                        className="press rounded-md border border-border bg-card py-2.5 text-sm font-semibold"
                      >
                        🔬 {t('crops.diseaseScanner')}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/assistant', { state: { ask: `What should I do for my ${c.name} at ${c.stage} stage?` } })}
                        className="press rounded-md border border-border bg-card py-2.5 text-sm font-semibold"
                      >
                        🤖 {t('home.askAi')}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCrops(crops.filter((x) => x.id !== c.id))}
                      className="w-full py-1 text-xs font-semibold text-destructive"
                    >
                      Remove crop
                    </button>
                  </div>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="press flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-4 font-display font-bold text-muted-foreground"
        >
          <Plus size={18} aria-hidden /> {t('crops.addCrop')}
        </button>
      </Reveal>

      <Reveal>
        <SectionTitle title={t('tools.smartTools')} />
        <div className="grid grid-cols-2 gap-3">
          <ActionTile emoji="🔬" label={t('crops.diseaseScanner')} sublabel={t('crops.diseaseScannerSub')} onClick={() => navigate('/tools/disease')} />
          <ActionTile emoji="📅" label={t('crops.cropCalendar')} sublabel={t('crops.cropCalendarSub')} onClick={() => navigate('/tools/rotation')} />
          <ActionTile emoji="📈" label={t('crops.yieldPrediction')} sublabel={t('crops.yieldSub')} onClick={() => navigate('/tools/yield')} />
          <ActionTile emoji="🧪" label={t('crops.soilHealth')} sublabel={t('crops.soilSub')} onClick={() => navigate('/tools/soil')} />
        </div>
      </Reveal>

      {adding && <AddCropSheet onClose={() => setAdding(false)} onAdd={(c) => setCrops([...crops, c])} />}
    </div>
  );
}
