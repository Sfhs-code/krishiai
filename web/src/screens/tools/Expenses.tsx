import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Mic, X } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { asrSupported, listen } from '../../lib/speech';
import type { Expense } from '../../lib/types';
import { SignalPill } from '../../components/StatusLight';
import { Field, PrimaryButton, ScreenHeader, SpeakButton, inputClass } from '../../components/ui';

const CATEGORIES: { key: Expense['category']; emoji: string; label: string }[] = [
  { key: 'seed', emoji: '🌱', label: 'Seed' },
  { key: 'fertiliser', emoji: '🧪', label: 'Fertiliser' },
  { key: 'labour', emoji: '👷', label: 'Labour' },
  { key: 'fuel', emoji: '⛽', label: 'Fuel' },
  { key: 'irrigation', emoji: '💧', label: 'Irrigation' },
  { key: 'other', emoji: '📦', label: 'Other' },
  { key: 'income', emoji: '💰', label: 'Income' },
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function Expenses() {
  const { t } = useTranslation();
  const { expenses, addExpense, lang } = useApp();

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('seed');
  const [listening, setListening] = useState(false);

  const totals = useMemo(() => {
    const income = expenses.filter((e) => e.category === 'income').reduce((a, b) => a + b.amount, 0);
    const spend = expenses.filter((e) => e.category !== 'income').reduce((a, b) => a + b.amount, 0);
    return { income, spend, net: income - spend, margin: income ? Math.round(((income - spend) / income) * 100) : 0 };
  }, [expenses]);

  /**
   * Voice entry: "two thousand for urea" → amount 2000, label "for urea".
   * Digits are picked out of the transcript; the rest becomes the note.
   */
  const dictate = () => {
    if (!asrSupported() || listening) return;
    setListening(true);
    listen(lang, {
      onResult: (text) => {
        const digits = text.replace(/,/g, '').match(/\d+/);
        if (digits) setAmount(digits[0]);
        setLabel(text.replace(/[\d,]+/g, '').replace(/\s+/g, ' ').trim() || text);
        setAdding(true);
      },
      onError: () => setListening(false),
      onEnd: () => setListening(false),
    });
  };

  const save = () => {
    const amt = Number(amount);
    if (!amt || !label.trim()) return;
    addExpense({ label: label.trim(), amount: amt, category, date: new Date().toISOString().slice(0, 10) });
    setLabel('');
    setAmount('');
    setAdding(false);
  };

  return (
    <div className="space-y-5">
      <ScreenHeader
        title={t('tools.expenseTracker')}
        subtitle={t('tools.expenseTrackerSub')}
        back
        speakText={`Income ${inr(totals.income)}. Spending ${inr(totals.spend)}. Net ${inr(totals.net)}.`}
      />

      <section className="glass-card p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Income</p>
            <p className="font-display text-2xl font-extrabold text-primary">{inr(totals.income)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Spending</p>
            <p className="font-display text-2xl font-extrabold text-destructive">{inr(totals.spend)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('mandi.netProfit')}</p>
            <p className={`font-display text-3xl font-extrabold ${totals.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {inr(totals.net)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SignalPill
              signal={totals.margin >= 30 ? 'green' : totals.margin >= 10 ? 'yellow' : 'red'}
              label={t('mandi.margin', { n: totals.margin })}
              size="sm"
            />
            <SpeakButton text={`Net profit ${inr(totals.net)}, margin ${totals.margin} percent.`} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <PrimaryButton onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden /> Add entry
        </PrimaryButton>
        <button
          type="button"
          onClick={dictate}
          className={`press flex items-center justify-center gap-2 rounded-md border py-3.5 font-semibold ${
            listening ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border bg-card'
          }`}
        >
          <Mic size={18} aria-hidden /> {listening ? t('speakNow') : 'Say it'}
        </button>
      </div>

      {adding && (
        <section className="solid-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Add entry</h2>
            <button type="button" onClick={() => setAdding(false)} aria-label={t('close')} className="press rounded-full border border-border p-2">
              <X size={15} aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`press flex flex-col items-center gap-1 rounded-md border-2 py-2.5 ${
                  category === c.key ? 'border-primary bg-primary-soft' : 'border-border'
                }`}
              >
                <span className="text-xl leading-none" aria-hidden>{c.emoji}</span>
                <span className="text-[10px] font-semibold leading-none">{c.label}</span>
              </button>
            ))}
          </div>
          <Field label="What was it for">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Urea 2 bags" />
          </Field>
          <Field label="Amount (₹)">
            <input className={inputClass} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1450" />
          </Field>
          <PrimaryButton onClick={save} disabled={!amount || !label.trim()}>
            {t('save')}
          </PrimaryButton>
        </section>
      )}

      <section className="solid-card divide-y divide-border">
        {expenses.map((e) => {
          const cat = CATEGORIES.find((c) => c.key === e.category);
          const income = e.category === 'income';
          return (
            <div key={e.id} className="flex items-center gap-3 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg" aria-hidden>
                {cat?.emoji ?? '📦'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">{e.label}</p>
                <p className="text-xs text-muted-foreground">
                  {cat?.label} · {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <p className={`shrink-0 font-display font-bold ${income ? 'text-primary' : 'text-destructive'}`}>
                {income ? '+' : '−'} {inr(e.amount)}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
