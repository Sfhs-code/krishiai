import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ChevronRight } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { matchSchemes } from '../lib/api';
import { DEMO_SCHEMES } from '../lib/demoData';
import type { Scheme } from '../lib/types';
import { Reveal } from '../components/Reveal';
import { SignalPill } from '../components/StatusLight';
import { CardSkeleton, ScreenHeader, SectionTitle, SpeakButton } from '../components/ui';

const TOOLS = [
  { emoji: '🔬', to: '/tools/disease', key: 'diseaseDetection' },
  { emoji: '🧾', to: '/tools/verify', key: 'fertilizerScanner' },
  { emoji: '📈', to: '/tools/yield', key: 'yieldPrediction' },
  { emoji: '🏛️', to: '/tools/schemes', key: 'govtSchemes' },
  { emoji: '🧪', to: '/tools/soil', key: 'soilHealth' },
  { emoji: '🔄', to: '/tools/rotation', key: 'cropRotation' },
  { emoji: '🌱', to: '/tools/diversify', key: 'landUse' },
  { emoji: '💵', to: '/tools/expenses', key: 'expenseTracker' },
  { emoji: '♻️', to: '/tools/organic', key: 'organicAdvisor' },
  { emoji: '🚨', to: '/tools/sos', key: 'emergencySos' },
] as const;

export default function Tools() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, crops, lang, expenses } = useApp();

  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loadingSchemes, setLoadingSchemes] = useState(true);

  useEffect(() => {
    let alive = true;
    void matchSchemes({ profile, crops: crops.map((c) => c.name), lang })
      .then((res) => alive && setSchemes(res.data))
      .catch(() => alive && setSchemes(DEMO_SCHEMES))
      .finally(() => alive && setLoadingSchemes(false));
    return () => {
      alive = false;
    };
  }, [profile, crops, lang]);

  /* Monthly income vs expense, derived from the diary. */
  const chart = useMemo(() => {
    const buckets = new Map<string, { income: number; expense: number }>();
    for (const e of expenses) {
      const key = e.date.slice(0, 7);
      const b = buckets.get(key) ?? { income: 0, expense: 0 };
      if (e.category === 'income') b.income += e.amount;
      else b.expense += e.amount;
      buckets.set(key, b);
    }
    const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
    const max = Math.max(1, ...sorted.flatMap(([, v]) => [v.income, v.expense]));
    return sorted.map(([key, v]) => ({
      label: new Date(`${key}-01`).toLocaleDateString('en-IN', { month: 'short' })[0],
      income: v.income,
      expense: v.expense,
      incomePct: (v.income / max) * 100,
      expensePct: (v.expense / max) * 100,
    }));
  }, [expenses]);

  const eligible = schemes.filter((s) => s.eligible);
  const schemeSummary = eligible.map((s) => `${s.name}: ${s.benefit}.`).join(' ');

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('tools.title')} subtitle={t('tools.subtitle')} />

      <Reveal>
        <SectionTitle title={t('tools.smartTools')} />
        <div className="grid grid-cols-2 gap-3">
          {TOOLS.map((tool, i) => (
            <button
              key={tool.to}
              type="button"
              onClick={() => navigate(tool.to)}
              style={{ animationDelay: `${i * 30}ms` }}
              className={`press flex flex-col items-start gap-2 rounded-lg border p-4 text-left shadow-glass ${
                tool.key === 'emergencySos'
                  ? 'border-[oklch(84%_0.09_25)] bg-[oklch(94%_0.04_25)]'
                  : 'border-border bg-card'
              }`}
            >
              <span className="text-3xl leading-none" aria-hidden>{tool.emoji}</span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-bold leading-tight">{t(`tools.${tool.key}`)}</span>
                <span className="block text-xs leading-tight text-muted-foreground">{t(`tools.${tool.key}Sub`)}</span>
              </span>
            </button>
          ))}
        </div>
      </Reveal>

      {/* ------------------------------------------------------- schemes */}
      <Reveal>
        <SectionTitle
          title={t('tools.schemesTitle')}
          action={schemeSummary ? <SpeakButton text={schemeSummary} /> : undefined}
        />
        <div className="space-y-2.5">
          {loadingSchemes && schemes.length === 0
            ? [0, 1, 2].map((i) => <CardSkeleton key={i} lines={1} />)
            : schemes.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate('/tools/schemes')}
                  className="press flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-glass"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold leading-tight">{s.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{s.benefit}</p>
                  </div>
                  <SignalPill
                    signal={s.eligible ? 'green' : 'red'}
                    label={s.eligible ? t('tools.eligible') : t('tools.notEligible')}
                    size="sm"
                  />
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
        </div>
        <button
          type="button"
          onClick={() => navigate('/tools/schemes')}
          className="press mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card py-3 text-sm font-semibold"
        >
          {t('tools.govtSchemes')} <ExternalLink size={14} aria-hidden />
        </button>
      </Reveal>

      {/* --------------------------------------------------------- chart */}
      <Reveal>
        <SectionTitle title={t('tools.incomeVsExpense')} />
        <section className="solid-card p-4">
          <div className="flex h-40 items-end gap-2">
            {chart.map((m, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  {/* A zero month renders no bar at all — a minimum-height stub
                      would read as "a little income" when there was none. */}
                  <div
                    className="w-1/2 rounded-t-sm bg-primary transition-[height] duration-500"
                    style={{ height: m.income > 0 ? `${Math.max(m.incomePct, 3)}%` : 0 }}
                    title={`Income ₹${m.income.toLocaleString('en-IN')}`}
                  />
                  <div
                    className="w-1/2 rounded-t-sm bg-[oklch(75%_0.14_75)] transition-[height] duration-500"
                    style={{ height: m.expense > 0 ? `${Math.max(m.expensePct, 3)}%` : 0 }}
                    title={`Expense ₹${m.expense.toLocaleString('en-IN')}`}
                  />
                </div>
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 border-t border-border pt-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" aria-hidden /> Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[oklch(75%_0.14_75)]" aria-hidden /> Expense
            </span>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
