import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogIn, LogOut, MapPin, Trash2, Volume2, VolumeX, Check, Loader2 } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { LANGUAGES } from '../i18n';
import { continueAsGuest, signInWithGoogle, signOut } from '../lib/firebase';
import { cacheSize, clearCache } from '../lib/cache';
import { apiHealth } from '../lib/api';
import type { LangCode } from '../lib/types';
import { Reveal } from '../components/Reveal';
import { SignalPill } from '../components/StatusLight';
import { Field, PrimaryButton, ScreenHeader, SectionTitle, Stat, inputClass } from '../components/ui';

export default function Profile() {
  const { t } = useTranslation();
  const { user, profile, updateProfile, lang, changeLanguage, autoSpeak, setAutoSpeak, isOnline, useMyLocation, locating } =
    useApp();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [items, setItems] = useState(0);
  const [health, setHealth] = useState<{ gemini: boolean; weather: boolean; mandi: boolean } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    void cacheSize().then(setItems);
    void apiHealth().then(setHealth);
  }, []);

  useEffect(() => setDraft(profile), [profile]);

  const doSignIn = async (fn: () => Promise<unknown>) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await fn();
    } catch {
      setAuthError('Sign-in failed. Check that the sign-in method is enabled in Firebase Authentication.');
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <ScreenHeader title={t('profile.title')} />

      {/* -------------------------------------------------------- account */}
      <Reveal>
        <section className="glass-card p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-soft text-3xl" aria-hidden>
              {user && !user.isAnonymous ? '🧑‍🌾' : '👤'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold leading-tight">
                {user && !user.isAnonymous ? (user.displayName ?? profile.name) : t('guestFarmer')}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {user && !user.isAnonymous ? (user.email ?? '') : t('profile.signInPrompt')}
              </p>
            </div>
          </div>

          {authError && (
            <p className="mt-3 rounded-md bg-[oklch(93%_0.05_25)] px-3 py-2 text-sm text-[oklch(45%_0.17_25)]">{authError}</p>
          )}

          <div className="mt-4">
            {user && !user.isAnonymous ? (
              <button
                type="button"
                onClick={() => void signOut()}
                className="press flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-3 font-semibold"
              >
                <LogOut size={17} aria-hidden /> {t('signOut')}
              </button>
            ) : (
              <div className="grid gap-2">
                <PrimaryButton onClick={() => void doSignIn(signInWithGoogle)} disabled={authBusy || !isOnline}>
                  {authBusy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <LogIn size={17} aria-hidden />}
                  {t('signIn')}
                </PrimaryButton>
                {!user && (
                  <button
                    type="button"
                    onClick={() => void doSignIn(continueAsGuest)}
                    disabled={authBusy || !isOnline}
                    className="press rounded-md border border-border bg-card py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {t('continueGuest')}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* ---------------------------------------------------- farm details */}
      <Reveal delay={40}>
        <SectionTitle
          title={t('profile.farmDetails')}
          action={
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="press rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              {editing ? t('cancel') : t('profile.editProfile')}
            </button>
          }
        />
        <section className="solid-card p-4">
          {editing ? (
            <div className="space-y-3">
              <Field label="Name">
                <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Village">
                  <input className={inputClass} value={draft.village} onChange={(e) => setDraft({ ...draft, village: e.target.value })} />
                </Field>
                <Field label="District">
                  <input className={inputClass} value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <input className={inputClass} value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} />
                </Field>
                <Field label={t('profile.landSize')}>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={String(draft.landAcre)}
                    onChange={(e) => setDraft({ ...draft, landAcre: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('profile.soilType')}>
                  <input className={inputClass} value={draft.soilType} onChange={(e) => setDraft({ ...draft, soilType: e.target.value })} />
                </Field>
                <Field label={t('profile.irrigation')}>
                  <input className={inputClass} value={draft.irrigation} onChange={(e) => setDraft({ ...draft, irrigation: e.target.value })} />
                </Field>
              </div>
              <PrimaryButton
                onClick={() => {
                  updateProfile(draft);
                  setEditing(false);
                }}
              >
                <Check size={17} aria-hidden /> {t('save')}
              </PrimaryButton>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat label={t('profile.location')} value={`${profile.village}, ${profile.district}`} sub={profile.state} />
              <Stat label={t('profile.landSize')} value={`${profile.landAcre} acre`} />
              <Stat label={t('profile.soilType')} value={profile.soilType} />
              <Stat label={t('profile.irrigation')} value={profile.irrigation} />
            </div>
          )}

          <button
            type="button"
            onClick={() => void useMyLocation()}
            className="press mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-2.5 text-sm font-semibold"
          >
            {locating ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <MapPin size={15} aria-hidden />}
            {t('profile.useMyLocation', { lat: profile.lat.toFixed(2), lon: profile.lon.toFixed(2) })}
          </button>
        </section>
      </Reveal>

      {/* -------------------------------------------------------- language */}
      <Reveal delay={80}>
        <SectionTitle title={t('profile.language')} />
        <section className="solid-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">{t('profile.languageHint')}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => changeLanguage(l.code as LangCode)}
                className={`press flex items-center justify-between gap-2 rounded-md border-2 px-3.5 py-3 text-left ${
                  l.code === lang ? 'border-primary bg-primary-soft' : 'border-border'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-base font-bold leading-tight">{l.native}</span>
                  <span className="text-[11px] text-muted-foreground">{l.label}</span>
                </span>
                {l.code === lang && <Check size={16} className="shrink-0 text-primary" strokeWidth={3} aria-hidden />}
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ------------------------------------------------------ voice + data */}
      <Reveal delay={120}>
        <SectionTitle title={t('profile.voiceGuide')} />
        <section className="solid-card divide-y divide-border">
          <button
            type="button"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${autoSpeak ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground'}`}>
              {autoSpeak ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">
                {autoSpeak ? t('profile.voiceGuideOn') : t('profile.voiceGuideOff')}
              </span>
              <span className="text-xs text-muted-foreground">Alerts and results are read aloud automatically</span>
            </span>
            <span
              className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors ${autoSpeak ? 'bg-primary' : 'bg-border'}`}
              aria-hidden
            >
              <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${autoSpeak ? 'translate-x-5' : ''}`} />
            </span>
          </button>

          <div className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg" aria-hidden>💾</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">{t('profile.dataSaved')}</span>
              <span className="text-xs text-muted-foreground">{t('profile.cacheItems', { n: items })}</span>
            </span>
            <button
              type="button"
              onClick={() => void clearCache().then(() => setItems(0))}
              className="press flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-destructive"
            >
              <Trash2 size={13} aria-hidden /> {t('profile.clearCache')}
            </button>
          </div>
        </section>
      </Reveal>

      {/* ---------------------------------------------------- live services */}
      <Reveal delay={160}>
        <SectionTitle title={t('profile.apiStatus')} />
        <section className="solid-card divide-y divide-border">
          {[
            { key: 'gemini', label: 'Gemini AI', note: 'Chat, disease scan, verification' },
            { key: 'weather', label: 'OpenWeather', note: 'Live weather & forecast' },
            { key: 'mandi', label: 'Mandi prices', note: 'data.gov.in Agmarknet' },
          ].map((row) => {
            const live = health?.[row.key as keyof typeof health] ?? false;
            return (
              <div key={row.key} className="flex items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{row.label}</span>
                  <span className="text-xs text-muted-foreground">{row.note}</span>
                </span>
                <SignalPill
                  signal={live ? 'green' : 'yellow'}
                  label={live ? t('profile.connected') : t('profile.demoMode')}
                  size="sm"
                />
              </div>
            );
          })}
        </section>
        {health === null && (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Backend not reachable — the app is running on saved and demo data. Deploy the Cloud Functions with your API
            keys to go live.
          </p>
        )}
      </Reveal>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        {t('appName')} · {t('tagline')}
      </p>
    </div>
  );
}
