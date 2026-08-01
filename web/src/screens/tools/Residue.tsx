import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Recycle, Flame, Ban, Tractor, IndianRupee, Sprout, MapPin } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { planResidue, ApiUnavailable } from '../../lib/api';
import type { ResiduePlan } from '../../lib/types';
import { SignalPill } from '../../components/StatusLight';
import { Field, PrimaryButton, ScreenHeader, SpeakButton, inputClass } from '../../components/ui';

const COMMON_CROPS = [
  { key: 'Paddy (Rice)', emoji: '🌾' },
  { key: 'Wheat', emoji: '🌿' },
  { key: 'Maize', emoji: '🌽' },
  { key: 'Cotton', emoji: '🪴' },
  { key: 'Sugarcane', emoji: '🎋' },
  { key: 'Mustard', emoji: '🌼' },
] as const;

/** Hard-coded fallback plan that works even when the AI is unreachable. */
function fallbackPlan(crop: string, acres: number): ResiduePlan {
  return {
    summary: `Your ${acres} acre ${crop} harvest produced roughly ${Math.round(acres * 3)} tonnes of crop residue. Instead of burning, you can turn this into income and better soil.`,
    estimatedResidue: `About ${Math.round(acres * 3)} tonnes`,
    burningHarms: [
      'Fine of ₹2,500 to ₹15,000 under CAQM rules. Repeated offences attract higher penalties.',
      'Every tonne burnt destroys 5.5 kg nitrogen, 2.3 kg phosphorus, and 25 kg potassium — nutrients you would have to buy back as fertiliser.',
      'Burning kills earthworms, beneficial bacteria, and fungal networks in the top 5 cm of soil, reducing fertility for the next 2 to 3 seasons.',
    ],
    machinery: [
      {
        name: 'Happy Seeder',
        emoji: '🚜',
        description: 'Cuts and lifts the standing stubble, sows wheat seed directly underneath, and lays the straw back as mulch — one pass, no extra tilling.',
        subsidy: '50% under CRM scheme',
        whereToGet: 'Custom Hiring Centre (CHC) or cooperative society',
      },
      {
        name: 'Super SMS (Straw Management System)',
        emoji: '⚙️',
        description: 'Attaches to the combine harvester and chops straw evenly over the field during the harvest itself — zero extra cost per acre.',
        subsidy: '50% under CRM scheme',
        whereToGet: 'Most large combine owners already have one — ask before hiring',
      },
      {
        name: 'Baler',
        emoji: '🎯',
        description: 'Compresses loose straw into transportable bales that you can sell. A tractor-mounted baler covers 4 to 5 acres per hour.',
        subsidy: '50% under CRM scheme',
        whereToGet: 'CHC, FPO, or private baler service providers',
      },
    ],
    sellOptions: [
      {
        buyer: 'Biomass power plant',
        emoji: '🔌',
        description: 'Several biomass plants in North India buy baled straw. They arrange pickup if you have 10 tonnes or more.',
        estimatedRate: '₹1,800 – ₹2,500 per tonne',
      },
      {
        buyer: 'Cattle fodder trader',
        emoji: '🐄',
        description: 'Wheat straw and paddy straw (after silage treatment) have steady demand from dairy farmers year-round.',
        estimatedRate: '₹1,500 – ₹2,000 per tonne',
      },
    ],
    soilBenefit: [
      'Incorporated residue adds organic carbon, improving water retention by up to 20% and reducing your irrigation cost.',
      'Straw mulch keeps the soil surface 4 to 6°C cooler in April–May, protecting germinating seeds and soil organisms.',
    ],
    speak: `Your ${acres} acre ${crop} harvest left about ${Math.round(acres * 3)} tonnes of residue. Do not burn it — the fine is up to fifteen thousand rupees, and you lose valuable nutrients. Instead, use a Happy Seeder or sell the baled straw to a biomass plant for around two thousand rupees per tonne.`,
  };
}

export default function Residue() {
  const { t } = useTranslation();
  const { profile, lang, say } = useApp();

  const [crop, setCrop] = useState('');
  const [acres, setAcres] = useState(String(profile.landAcre ?? 2));
  const [plan, setPlan] = useState<ResiduePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async () => {
    if (!crop.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await planResidue({ cropName: crop.trim(), acres: Number(acres) || 1, lang, profile });
      setPlan(res);
      say(res.speak);
    } catch (err) {
      const fb = fallbackPlan(crop.trim(), Number(acres) || 1);
      setPlan(fb);
      say(fb.speak);
      setNote(
        err instanceof ApiUnavailable && err.reason === 'no-key'
          ? t('residue.noKeyNote')
          : t('residue.offlineNote'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('residue.title')} subtitle={t('residue.subtitle')} back />

      {/* -------- Input form -------- */}
      <section className="solid-card space-y-4 p-4">
        <Field label={t('residue.whichCrop')}>
          <input
            className={inputClass}
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder="Paddy, Wheat, Maize…"
          />
        </Field>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {COMMON_CROPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCrop(c.key)}
              className={`press flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                crop === c.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <span>{c.emoji}</span>
              {c.key}
            </button>
          ))}
        </div>

        <Field label={`${t('residue.harvestedArea')} (acre)`}>
          <input
            className={inputClass}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            value={acres}
            onChange={(e) => setAcres(e.target.value)}
          />
        </Field>

        <PrimaryButton onClick={() => void run()} disabled={busy || !crop.trim()}>
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Recycle size={18} aria-hidden />}
          {busy ? t('residue.planning') : t('residue.getPlan')}
        </PrimaryButton>
      </section>

      {note && (
        <p className="rounded-md bg-[oklch(94%_0.08_82)] px-4 py-3 text-sm font-medium text-[oklch(42%_0.1_70)]">{note}</p>
      )}

      {/* -------- Results -------- */}
      {plan && (
        <div className="space-y-4">
          {/* Summary */}
          <section className="glass-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <SignalPill signal="green" label={t('residue.estResidue')} size="sm" />
              <span className="flex-1 text-sm font-bold">{plan.estimatedResidue}</span>
              <SpeakButton text={plan.speak} />
            </div>
            <p className="text-[15px] leading-relaxed">{plan.summary}</p>
          </section>

          {/* Burning harms */}
          {plan.burningHarms?.length > 0 && (
            <section className="solid-card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <Flame size={18} className="text-destructive" aria-hidden />
                <h2 className="flex-1 font-display text-lg font-bold text-destructive">{t('residue.burningTitle')}</h2>
              </div>
              <ul className="divide-y divide-border">
                {plan.burningHarms.map((harm) => (
                  <li key={harm} className="flex gap-3 p-4">
                    <Ban size={15} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
                    <span className="text-[15px] leading-relaxed">{harm}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Machinery */}
          {plan.machinery?.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Tractor size={18} className="text-primary" aria-hidden />
                <h2 className="flex-1 font-display text-xl font-bold">{t('residue.machinery')}</h2>
              </div>
              <div className="space-y-3">
                {plan.machinery.map((m) => (
                  <article key={m.name} className="solid-card space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-2xl" aria-hidden>
                        {m.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-bold leading-tight">{m.name}</h3>
                        <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{m.description}</p>
                      </div>
                    </div>
                    <SignalPill signal="green" label={m.subsidy} size="sm" />
                    <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-sm leading-relaxed">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                      {m.whereToGet}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Sell options */}
          {plan.sellOptions?.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <IndianRupee size={18} className="text-primary" aria-hidden />
                <h2 className="flex-1 font-display text-xl font-bold">{t('residue.sellTitle')}</h2>
              </div>
              <div className="space-y-3">
                {plan.sellOptions.map((s) => (
                  <article key={s.buyer} className="solid-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-2xl" aria-hidden>
                        {s.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-bold leading-tight">{s.buyer}</h3>
                        <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{s.description}</p>
                        <SignalPill signal="green" label={s.estimatedRate} size="sm" className="mt-2.5" />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Soil benefit */}
          {plan.soilBenefit?.length > 0 && (
            <section className="glass-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sprout size={18} className="text-primary" aria-hidden />
                <h2 className="flex-1 font-display text-lg font-bold">{t('residue.soilBenefit')}</h2>
              </div>
              <ul className="space-y-2.5">
                {plan.soilBenefit.map((b) => (
                  <li key={b} className="flex gap-2.5 text-[15px] leading-relaxed text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
