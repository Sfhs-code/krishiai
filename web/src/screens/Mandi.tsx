import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Clock, Navigation, Trophy } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { loadMandi } from '../lib/api';
import { DEMO_MANDI } from '../lib/demoData';
import type { MandiPrice } from '../lib/types';
import { Reveal } from '../components/Reveal';
import { SignalBanner, SignalPill, SIGNAL_STYLES } from '../components/StatusLight';
import { CardSkeleton, Field, ScreenHeader, SectionTitle, SpeakButton, StaleBadge, inputClass } from '../components/ui';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function Mandi() {
  const { t } = useTranslation();
  const { profile, crops, lang, say } = useApp();

  const [rows, setRows] = useState<MandiPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [qty, setQty] = useState('20');
  const [price, setPrice] = useState('2450');
  const [cost, setCost] = useState('1400');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadMandi(profile.state, crops.map((c) => c.name), lang)
      .then((res) => {
        if (!alive) return;
        setRows(res.data);
        setSavedAt(res.stale ? res.savedAt : null);
      })
      .catch(() => alive && setRows(DEMO_MANDI))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [profile.state, crops, lang]);

  const congested = useMemo(() => rows.filter((r) => r.congestion === 'red'), [rows]);

  const best = useMemo(() => {
    const mine = crops.map((c) => c.name.toLowerCase());
    const relevant = rows.filter((r) => mine.includes(r.commodity.toLowerCase()));
    const pool = relevant.length ? relevant : rows;
    return pool.reduce<MandiPrice | null>((a, b) => (!a || b.modalPrice > a.modalPrice ? b : a), null);
  }, [rows, crops]);

  // Announce a divert-now situation the moment the screen has data.
  useEffect(() => {
    if (congested.length) {
      say(`${congested[0].market} is congested. Wait time is about ${congested[0].waitMinutes} minutes. Consider another yard.`);
    }
  }, [congested, say]);

  const q = Number(qty) || 0;
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const revenue = q * p;
  const totalCost = q * c;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const summary = rows
    .slice(0, 4)
    .map((r) => `${r.commodity} at ${r.market}, ${inr(r.modalPrice)} per quintal, ${r.changePct >= 0 ? 'up' : 'down'} ${Math.abs(r.changePct)} percent.`)
    .join(' ');

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('mandi.title')} subtitle={t('mandi.subtitle')} speakText={summary} />

      {savedAt !== null && (
        <div className="flex justify-center">
          <StaleBadge savedAt={savedAt} />
        </div>
      )}

      {congested.length > 0 && (
        <Reveal>
          <SignalBanner
            signal="red"
            title={`${congested[0].market} ${t('mandi.congestionDivert')}`}
            detail={`${t('mandi.wait', { n: congested[0].waitMinutes })}. ${
              rows.find((r) => r.congestion === 'green')
                ? `Try ${rows.find((r) => r.congestion === 'green')!.market} instead.`
                : ''
            }`}
          />
        </Reveal>
      )}

      {best && (
        <Reveal delay={40}>
          <section className="rounded-lg bg-leaf p-4 text-white shadow-float">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Trophy size={20} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{t('mandi.bestMarket')}</p>
                <p className="truncate font-display text-lg font-bold leading-tight">
                  {best.commodity} · {inr(best.modalPrice)}
                </p>
                <p className="truncate text-sm text-white/85">
                  {best.market} · {t('mandi.away', { n: best.distanceKm })}
                </p>
              </div>
              <SpeakButton
                text={`Best price now: ${best.commodity} at ${best.market}, ${inr(best.modalPrice)} per quintal.`}
                className="border-white/40 bg-white/15 text-white"
              />
            </div>
          </section>
        </Reveal>
      )}

      <div className="space-y-3">
        {loading && rows.length === 0
          ? [0, 1, 2].map((i) => <CardSkeleton key={i} lines={2} />)
          : rows.map((r, i) => {
              const s = SIGNAL_STYLES[r.congestion];
              const up = r.changePct >= 0;
              return (
                <Reveal key={r.id} delay={i * 40}>
                  <article className="solid-card p-4">
                    <div className="flex items-center gap-3.5">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-soft text-2xl" aria-hidden>
                        {r.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base font-bold leading-tight">{r.commodity}</p>
                        <p className="truncate text-sm text-muted-foreground">{r.market}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-xl font-extrabold leading-none">{inr(r.modalPrice)}</p>
                        <p className={`flex items-center justify-end gap-0.5 text-xs font-bold ${up ? 'text-primary' : 'text-destructive'}`}>
                          {up ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
                          {Math.abs(r.changePct).toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <SignalPill
                        signal={r.congestion}
                        size="sm"
                        label={
                          r.congestion === 'red'
                            ? t('mandi.congestionDivert')
                            : r.congestion === 'yellow'
                              ? t('mandi.congestionBusy')
                              : t('mandi.congestionNormal')
                        }
                      />
                      <span className={`flex items-center gap-1 text-xs font-semibold ${s.fg}`}>
                        <Clock size={12} aria-hidden /> {t('mandi.wait', { n: r.waitMinutes })}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Navigation size={12} aria-hidden /> {t('mandi.away', { n: r.distanceKm })}
                      </span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {inr(r.minPrice)}–{inr(r.maxPrice)}
                      </span>
                    </div>
                  </article>
                </Reveal>
              );
            })}
      </div>

      {/* ------------------------------------------------ profit calculator */}
      <Reveal>
        <SectionTitle title={t('mandi.profitCalc')} />
        <section className="solid-card space-y-4 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('mandi.quantity')}>
              <input className={inputClass} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label={t('mandi.pricePerQuintal')}>
              <input className={inputClass} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label={t('mandi.costPerQuintal')}>
              <input className={inputClass} inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2 rounded-md bg-muted p-4">
            <div className="flex justify-between text-[15px]">
              <span className="text-muted-foreground">{t('mandi.revenue')}</span>
              <span className="font-display font-bold">{inr(revenue)}</span>
            </div>
            <div className="flex justify-between text-[15px]">
              <span className="text-muted-foreground">{t('mandi.totalCost')}</span>
              <span className="font-display font-bold text-destructive">− {inr(totalCost)}</span>
            </div>
            <div className="flex items-end justify-between border-t border-border pt-2">
              <span className="font-semibold">{t('mandi.netProfit')}</span>
              <span className={`font-display text-2xl font-extrabold ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {inr(profit)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <SignalPill
                signal={margin >= 30 ? 'green' : margin >= 10 ? 'yellow' : 'red'}
                label={t('mandi.margin', { n: margin })}
                size="sm"
              />
              <SpeakButton text={`Net profit ${inr(profit)}, margin ${margin} percent.`} />
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
