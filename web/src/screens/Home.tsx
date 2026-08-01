import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Droplets, Wind, CloudRain, MapPin, Check, RefreshCw } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { loadWeather } from '../lib/api';
import { DEMO_WEATHER } from '../lib/demoData';
import type { WeatherBundle } from '../lib/types';
import { Reveal } from '../components/Reveal';
import { SignalBanner, SignalPill } from '../components/StatusLight';
import { ActionTile, CardSkeleton, SectionTitle, SpeakButton, StaleBadge } from '../components/ui';

const WEATHER_EMOJI: Record<string, string> = {
  '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️', '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️', '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️', '50d': '🌫️', '50n': '🌫️',
};

const icon = (code: string) => WEATHER_EMOJI[code] ?? '🌤️';

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, crops, lang, say, isOnline, useMyLocation, locating } = useApp();

  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const spoken = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadWeather(profile.lat, profile.lon, lang)
      .then((res) => {
        if (!alive) return;
        setWeather(res.data);
        setStale(res.stale);
        setSavedAt(res.stale ? res.savedAt : null);
      })
      .catch(() => {
        if (alive) setWeather(DEMO_WEATHER);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [profile.lat, profile.lon, lang, refreshKey]);

  /**
   * The irrigation verdict, in the farmer's language.
   *
   * The backend sends a machine-readable `kind` alongside the English text, so
   * the copy is rendered here rather than on the server. That matters because
   * this is the one message the app speaks aloud unprompted — hearing it in
   * English through a Hindi voice would be useless.
   */
  const irrigation = useMemo(() => {
    const irr = weather?.irrigation;
    if (!irr) return null;
    if (!irr.kind) return { title: irr.headline, detail: irr.detail, signal: irr.signal, litresSaved: irr.litresSaved };
    const vars = { rain: irr.rainChance ?? 0, temp: irr.tempC ?? 0, humidity: irr.humidity ?? 0 };
    return {
      title: t(`home.irrigation.${irr.kind}Title`),
      detail: t(`home.irrigation.${irr.kind}Detail`, vars),
      signal: irr.signal,
      litresSaved: irr.litresSaved,
    };
  }, [weather, t]);

  // Auto-play the one thing that changes a farmer's day: the irrigation call.
  useEffect(() => {
    if (!irrigation || spoken.current) return;
    spoken.current = true;
    say(`${irrigation.title}. ${irrigation.detail}`);
  }, [irrigation, say]);

  const plan = useMemo(() => {
    const items = crops
      .filter((c) => c.signal !== 'green')
      .map((c) => ({ id: c.id, emoji: c.emoji, text: `${c.nextAction} — ${c.name}`, when: c.nextActionIn, signal: c.signal }));
    items.push({ id: 'mandi', emoji: '💰', text: t('home.mandiPrices'), when: t('home.anytime'), signal: 'green' as const });
    if (weather && weather.now.rainChance > 60) {
      items.unshift({ id: 'rain', emoji: '🌧️', text: t('home.coverGrain'), when: t('home.beforeEvening'), signal: 'yellow' as const });
    }
    return items.slice(0, 4);
  }, [crops, weather, t]);

  const [doneIds, setDoneIds] = useState<string[]>([]);
  const sustainability = 76;

  const greeting = `${t('home.greeting')}, ${profile.name}`;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-2xl font-extrabold leading-tight">{greeting}</p>
            <button
              type="button"
              onClick={() => void useMyLocation()}
              className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"
            >
              <MapPin size={13} aria-hidden />
              <span className="truncate">{weather?.now.place ?? `${profile.village}, ${profile.district}`}</span>
              {locating && <RefreshCw size={12} className="animate-spin" aria-hidden />}
            </button>
          </div>
          {!isOnline && <StaleBadge savedAt={savedAt ?? Date.now()} />}
        </div>
      </Reveal>

      {/* ------------------------------------------------------- weather */}
      <Reveal delay={40}>
        {loading && !weather ? (
          <CardSkeleton lines={4} />
        ) : weather ? (
          <section className="glass-card overflow-hidden">
            <div className="flex items-start gap-4 p-5">
              <span className="text-[56px] leading-none" aria-hidden>
                {icon(weather.now.icon)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl font-extrabold leading-none">{Math.round(weather.now.tempC)}°</span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('home.feelsLike', { t: Math.round(weather.now.feelsLikeC) })}
                  </span>
                </div>
                <p className="mt-1 truncate text-[15px] font-semibold">{weather.now.condition}</p>
              </div>
              {stale && <StaleBadge savedAt={savedAt} />}
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
              {[
                { icon: Droplets, label: t('home.humidity'), value: `${weather.now.humidity}%` },
                { icon: Wind, label: t('home.wind'), value: `${Math.round(weather.now.windKph)} km/h` },
                { icon: CloudRain, label: t('home.rain'), value: `${weather.now.rainChance}%` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center gap-1 py-3">
                  <Icon size={16} className="text-primary" aria-hidden />
                  <span className="font-display text-base font-bold leading-none">{value}</span>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-border p-3 no-scrollbar">
              {weather.forecast.map((d) => (
                <div
                  key={d.day + d.date}
                  className="flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-md bg-card/70 px-2 py-2.5"
                >
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">{d.day}</span>
                  <span className="text-xl leading-none" aria-hidden>
                    {icon(d.icon)}
                  </span>
                  <span className="font-display text-sm font-bold leading-none">{Math.round(d.maxC)}°</span>
                  <span className="text-[11px] text-muted-foreground">{Math.round(d.minC)}°</span>
                  {d.rainChance > 40 && (
                    <span className="text-[10px] font-semibold text-primary">{d.rainChance}%</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </Reveal>

      {/* --------------------------------------------------- irrigation */}
      {irrigation && (
        <Reveal delay={80}>
          <SignalBanner
            signal={irrigation.signal}
            title={irrigation.title}
            detail={irrigation.detail}
            action={
              <div className="flex items-center gap-3">
                {irrigation.litresSaved > 0 && (
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                    💧 {t('home.litresSaved', { n: irrigation.litresSaved.toLocaleString('en-IN') })}
                  </span>
                )}
                <SpeakButton text={`${irrigation.title}. ${irrigation.detail}`} />
              </div>
            }
          />
        </Reveal>
      )}

      {/* ------------------------------------------------ quick actions */}
      <Reveal delay={120}>
        <SectionTitle title={t('home.quickActions')} />
        <div className="grid grid-cols-2 gap-3">
          <ActionTile emoji="🔬" label={t('home.scanDisease')} sublabel={t('tools.diseaseDetectionSub')} tone="primary" onClick={() => navigate('/tools/disease')} />
          <ActionTile emoji="🤖" label={t('home.askAi')} sublabel={t('assistant.subtitle')} onClick={() => navigate('/assistant')} />
          <ActionTile emoji="💰" label={t('home.mandiPrices')} sublabel={t('mandi.subtitle')} onClick={() => navigate('/mandi')} />
          <ActionTile emoji="📔" label={t('home.farmDiary')} sublabel={t('tools.expenseTrackerSub')} onClick={() => navigate('/tools/expenses')} />
        </div>
      </Reveal>

      {/* --------------------------------------------------- today plan */}
      <Reveal delay={160}>
        <SectionTitle
          title={t('home.todayPlan')}
          action={<SpeakButton text={plan.map((p) => p.text).join('. ')} />}
        />
        <ul className="space-y-2.5">
          {plan.map((item) => {
            const done = doneIds.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setDoneIds((d) => (done ? d.filter((x) => x !== item.id) : [...d, item.id]))}
                  className={`press flex w-full items-center gap-3 rounded-lg border p-3.5 text-left shadow-glass ${
                    done ? 'border-border bg-muted opacity-60' : 'border-border bg-card'
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {item.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold leading-tight ${done ? 'line-through' : ''}`}>{item.text}</span>
                    <span className="text-xs text-muted-foreground">{item.when}</span>
                  </span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                      done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    }`}
                    aria-hidden
                  >
                    {done && <Check size={15} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Reveal>

      {/* ------------------------------------------------ sustainability */}
      <Reveal delay={200}>
        <section className="solid-card p-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="20" cy="20" r="17" fill="none" stroke="var(--muted)" strokeWidth="5" />
                <circle
                  cx="20" cy="20" r="17" fill="none"
                  stroke="var(--primary)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${(sustainability / 100) * 2 * Math.PI * 17} 999`}
                />
              </svg>
              <span className="font-display text-2xl font-extrabold">{sustainability}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-tight">{t('home.sustainability')}</p>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">{t('home.vsNeighbours', { n: 18 })}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <SignalPill signal="green" label={t('home.waterUse')} size="sm" />
                <SignalPill signal="yellow" label={t('home.fertiliser')} size="sm" />
                <SignalPill signal="green" label={t('home.soilCover')} size="sm" />
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal delay={240}>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="press mx-auto flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground"
        >
          <RefreshCw size={14} aria-hidden /> {t('retry')}
        </button>
      </Reveal>
    </div>
  );
}
