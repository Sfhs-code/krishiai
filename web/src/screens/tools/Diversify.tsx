import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { planDiversification, ApiUnavailable } from '../../lib/api';
import type { DiversificationPlan } from '../../lib/types';
import { SignalPill } from '../../components/StatusLight';
import { Field, PrimaryButton, ScreenHeader, SpeakButton, inputClass } from '../../components/ui';

/** Offline plan — the same options an extension officer would name first. */
function fallbackPlan(idleAcre: number): DiversificationPlan {
  return {
    currentUse: 'Idle / fallow',
    totalIdleAcre: idleAcre,
    options: [
      {
        id: 'agroforestry',
        title: 'Melia dubia agroforestry',
        emoji: '🌳',
        investment: `₹${Math.round(idleAcre * 18000).toLocaleString('en-IN')}`,
        monthlyIncome: '₹0 for 3 years, then ₹25,000+',
        paybackMonths: 42,
        effort: 'low',
        waterNeed: 'low',
        signal: 'green',
        why: 'Fast-growing timber suits idle bunds and field edges, needs almost no care after year one, and does not compete with your main crop.',
        steps: [
          'Order 400 saplings per acre from the state forest nursery.',
          'Plant at 2 m × 2 m spacing at the start of the monsoon.',
          'Water weekly for the first three months only.',
          'Register the plantation with the forest department for the felling permit.',
        ],
      },
      {
        id: 'apiary',
        title: 'Beekeeping (10 boxes)',
        emoji: '🐝',
        investment: '₹42,000',
        monthlyIncome: '₹8,000 – ₹12,000',
        paybackMonths: 5,
        effort: 'medium',
        waterNeed: 'low',
        signal: 'green',
        why: 'Uses almost no land, pays back within one season, and raises the yield of your own flowering crops through better pollination.',
        steps: [
          'Take the free 5-day NBB training at your KVK.',
          'Buy 10 Apis mellifera colonies with boxes.',
          'Place boxes 3 m apart in partial shade near a water source.',
          'Harvest honey every 40 days in the flowering season.',
        ],
      },
      {
        id: 'solar',
        title: 'Solar pump + lease',
        emoji: '☀️',
        investment: `₹${Math.round(idleAcre * 55000).toLocaleString('en-IN')} (60% subsidised)`,
        monthlyIncome: '₹6,000 from surplus power',
        paybackMonths: 30,
        effort: 'low',
        waterNeed: 'low',
        signal: 'yellow',
        why: 'PM-KUSUM covers most of the cost, and surplus power can be sold back — but approval takes 3 to 6 months.',
        steps: [
          'Apply on the PM-KUSUM portal with your land record.',
          'Get the DISCOM feasibility letter.',
          'Choose an empanelled vendor.',
          'Sign the power purchase agreement for the surplus.',
        ],
      },
      {
        id: 'mushroom',
        title: 'Oyster mushroom shed',
        emoji: '🍄',
        investment: '₹35,000',
        monthlyIncome: '₹15,000 – ₹20,000',
        paybackMonths: 3,
        effort: 'high',
        waterNeed: 'medium',
        signal: 'yellow',
        why: 'The fastest cash cycle of any option here — 45 days from spawn to sale — but it needs daily attention and a reliable buyer.',
        steps: [
          'Build a 20 × 15 ft shed with a thatch roof.',
          'Buy spawn from a certified lab.',
          'Pasteurise wheat straw and fill 40 bags.',
          'Line up a hotel or mandi buyer before the first harvest.',
        ],
      },
    ],
    speak:
      'I found four ways to use your idle land. Beekeeping pays back fastest, in about five months, and needs very little land. Agroforestry needs the least work but takes three years.',
  };
}

export default function Diversify() {
  const { t } = useTranslation();
  const { profile, lang, say } = useApp();

  const [idle, setIdle] = useState('1');
  const [budget, setBudget] = useState<'low' | 'medium' | 'high'>('medium');
  const [plan, setPlan] = useState<DiversificationPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await planDiversification({ idleAcre: Number(idle) || 1, profile, lang, budget });
      setPlan(res);
      say(res.speak);
    } catch (err) {
      const fb = fallbackPlan(Number(idle) || 1);
      setPlan(fb);
      say(fb.speak);
      setNote(
        err instanceof ApiUnavailable && err.reason === 'no-key'
          ? 'Showing the built-in plan — add a Gemini API key to the backend for advice tailored to your exact soil and market.'
          : 'You are offline, so this is the built-in plan. Connect for a plan tailored to your farm.',
      );
    } finally {
      setBusy(false);
    }
  };

  const effortSignal = (v: string) => (v === 'low' ? 'green' : v === 'medium' ? 'yellow' : 'red');

  return (
    <div className="space-y-5">
      <ScreenHeader title={t('diversify.title')} subtitle={t('diversify.subtitle')} back />

      <section className="solid-card space-y-4 p-4">
        <Field label={`${t('diversify.idleLand')} (acre) — you have ${profile.landAcre} total`}>
          <input className={inputClass} inputMode="decimal" value={idle} onChange={(e) => setIdle(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('diversify.budget')}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBudget(b)}
                className={`press rounded-md border-2 py-3 font-semibold ${
                  budget === b ? 'border-primary bg-primary-soft text-primary' : 'border-border'
                }`}
              >
                {t(`diversify.${b}`)}
              </button>
            ))}
          </div>
        </div>
        <PrimaryButton onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
          {busy ? t('diversify.planning') : t('diversify.getPlan')}
        </PrimaryButton>
      </section>

      {note && (
        <p className="rounded-md bg-[oklch(94%_0.08_82)] px-4 py-3 text-sm font-medium text-[oklch(42%_0.1_70)]">{note}</p>
      )}

      {plan && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 font-display text-xl font-bold">
              {plan.totalIdleAcre} acre · {plan.options.length} options
            </h2>
            <SpeakButton text={plan.speak} />
          </div>

          {plan.options.map((o, i) => (
            <article key={o.id} className="solid-card overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-2xl" aria-hidden>
                  {o.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate font-display text-lg font-bold leading-tight">{o.title}</h3>
                    {i === 0 && <SignalPill signal="green" label={t('diversify.recommended')} size="sm" />}
                  </div>
                  <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{o.why}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-border border-y border-border bg-muted/40">
                {[
                  { label: t('diversify.investment'), value: o.investment },
                  { label: t('diversify.monthlyIncome'), value: o.monthlyIncome },
                  { label: t('diversify.payback'), value: t('diversify.months', { n: o.paybackMonths }) },
                ].map((s) => (
                  <div key={s.label} className="px-2.5 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                    <p className="mt-0.5 text-[13px] font-bold leading-tight">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  <SignalPill signal={effortSignal(o.effort)} label={`${t('diversify.effort')}: ${t(`diversify.${o.effort}`)}`} size="sm" />
                  <SignalPill signal={effortSignal(o.waterNeed)} label={`${t('diversify.water')}: ${t(`diversify.${o.waterNeed}`)}`} size="sm" />
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="flex-1 font-display font-bold">{t('diversify.steps')}</h4>
                  <SpeakButton text={`${o.title}. ${o.steps.join('. ')}`} />
                </div>
                <ol className="space-y-2">
                  {o.steps.map((s, si) => (
                    <li key={si} className="flex gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                        {si + 1}
                      </span>
                      <span className="flex-1 text-[15px] leading-snug">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
