import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Sprout, Bot, Store, LayoutGrid, User as UserIcon, WifiOff, Volume2, VolumeX, Moon, Sun } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { LANGUAGES } from '../i18n';
import { VoiceMic } from './VoiceMic';
import { Sheet } from './Sheet';
import type { LangCode } from '../lib/types';

function LanguagePicker() {
  const { lang, changeLanguage } = useApp();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press rounded-full border border-border bg-card px-3 py-1.5 text-sm font-bold uppercase tracking-wide"
        aria-label="Change language"
      >
        {current.code}
      </button>

      {open && (
        <Sheet onClose={() => setOpen(false)} label="Language">
          <h2 className="mb-1 font-display text-2xl font-bold">भाषा · Language</h2>
          <p className="mb-5 text-sm text-muted-foreground">The whole app switches instantly.</p>
          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  changeLanguage(l.code as LangCode);
                  setOpen(false);
                }}
                className={`press rounded-md border-2 px-4 py-4 text-left ${
                  l.code === lang ? 'border-primary bg-primary-soft' : 'border-border bg-card'
                }`}
              >
                <span className="block font-display text-lg font-bold">{l.native}</span>
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

function ThemeToggle() {
  const { dark, setDark } = useApp();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => setDark(!dark)}
      aria-label={dark ? (t('profile.lightMode') || 'Light mode') : (t('profile.darkMode') || 'Dark mode')}
      className={`press flex h-9 w-9 items-center justify-center rounded-full border ${
        dark ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground'
      }`}
    >
      {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}

function TopBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOnline, autoSpeak, setAutoSpeak } = useApp();

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="glass-card mx-auto flex max-w-md items-center gap-2 rounded-2xl px-3 py-2.5">
        <NavLink to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf text-lg shadow-glass" aria-hidden>
            🌿
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-extrabold leading-tight">{t('appName')}</span>
            <span className="flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
              {isOnline ? (
                t('offlineReady')
              ) : (
                <>
                  <WifiOff size={11} aria-hidden /> {t('offline')}
                </>
              )}
            </span>
          </span>
        </NavLink>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSpeak(!autoSpeak)}
            aria-label={autoSpeak ? 'Turn off audio' : 'Turn on audio'}
            aria-pressed={autoSpeak}
            className={`press flex h-9 w-9 items-center justify-center rounded-full border ${
              autoSpeak ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {autoSpeak ? <Volume2 size={17} aria-hidden /> : <VolumeX size={17} aria-hidden />}
          </button>
          
          <ThemeToggle />

          <LanguagePicker />

          <button
            type="button"
            onClick={() => navigate('/tools/sos')}
            className="press rounded-full bg-destructive px-3.5 py-1.5 text-sm font-extrabold tracking-wide text-destructive-foreground shadow-glass"
          >
            {t('sos')}
          </button>
        </div>
      </div>
    </header>
  );
}

const NAV = [
  { to: '/', icon: Home, key: 'nav.home', end: true },
  { to: '/crops', icon: Sprout, key: 'nav.crops', end: false },
  { to: '/assistant', icon: Bot, key: 'nav.assistant', end: false },
  { to: '/mandi', icon: Store, key: 'nav.mandi', end: false },
  { to: '/tools', icon: LayoutGrid, key: 'nav.tools', end: false },
  { to: '/profile', icon: UserIcon, key: 'nav.profile', end: false },
] as const;

function BottomNav() {
  const { t } = useTranslation();
  // The mic sits between item 2 and 3 so it is under the thumb on any phone.
  const left = NAV.slice(0, 3);
  const right = NAV.slice(3);

  const item = (n: (typeof NAV)[number]) => {
    const Icon = n.icon;
    return (
      <NavLink
        key={n.to}
        to={n.to}
        end={n.end}
        className={({ isActive }) =>
          `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
            isActive ? 'text-primary' : 'text-muted-foreground'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon size={21} strokeWidth={isActive ? 2.6 : 2} aria-hidden />
            <span className="max-w-full truncate">{t(n.key)}</span>
          </>
        )}
      </NavLink>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] px-3 pb-4 safe-bottom">
      <div className="glass-card flex items-end justify-between rounded-[26px] px-1.5 py-1.5">
        {left.map(item)}
        <div className="flex w-[76px] shrink-0 justify-center">
          <VoiceMic />
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}

function DesktopSidebar() {
  const { t } = useTranslation();
  const { isOnline, autoSpeak, setAutoSpeak } = useApp();

  return (
    <aside className="sticky top-0 flex h-dvh w-[260px] shrink-0 flex-col border-r border-border bg-card/40 px-5 py-6 backdrop-blur-xl">
      <div className="mb-8 flex items-center justify-between">
        <NavLink to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf text-lg shadow-glass" aria-hidden>
            🌿
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-extrabold leading-tight">{t('appName')}</span>
            <span className="flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
              {isOnline ? (
                t('offlineReady')
              ) : (
                <>
                  <WifiOff size={11} aria-hidden /> {t('offline')}
                </>
              )}
            </span>
          </span>
        </NavLink>
      </div>

      <nav aria-label="Desktop Main" className="flex flex-col gap-1">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `press relative flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] font-bold tracking-wide transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-glass'
                    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`size-[18px] transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{t(n.key)}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSpeak(!autoSpeak)}
            aria-label={autoSpeak ? 'Turn off audio' : 'Turn on audio'}
            aria-pressed={autoSpeak}
            className={`press flex h-9 w-9 items-center justify-center rounded-full border ${
              autoSpeak ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground'
            }`}
          >
            {autoSpeak ? <Volume2 size={17} aria-hidden /> : <VolumeX size={17} aria-hidden />}
          </button>
          <ThemeToggle />
          <LanguagePicker />
        </div>
      </div>
    </aside>
  );
}

export function AppShell() {
  return (
    <>
      {/* Mobile Layout */}
      <div className="md:hidden min-h-dvh flex flex-col">
        <TopBar />
        <main className="mx-auto max-w-md w-full px-4 pb-32 pt-4 flex-1">
          <Outlet />
        </main>
        <BottomNav />
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-dvh">
        <DesktopSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl px-8 py-8 relative">
            <div className="absolute top-8 right-8">
              <div className="w-[120px]">
                 <VoiceMic />
              </div>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
