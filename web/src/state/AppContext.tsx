import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage, savedLanguage } from '../i18n';
import { readCache, writeCache, drainOutbox } from '../lib/cache';
import { DEMO_CROPS, DEMO_EXPENSES } from '../lib/demoData';
import { fetchFarmProfile, pushDiaryEntry, syncFarmProfile, watchAuth, type User } from '../lib/firebase';
import { speak as ttsSpeak, stopSpeaking, primeSpeech } from '../lib/speech';
import type { Crop, Expense, FarmProfile, LangCode } from '../lib/types';

const DEFAULT_PROFILE: FarmProfile = {
  name: 'Farmer',
  phone: '',
  village: 'Ozar',
  district: 'Nashik',
  state: 'Maharashtra',
  lat: 19.9975,
  lon: 73.7898,
  landAcre: 4.5,
  soilType: 'Black cotton',
  irrigation: 'Drip + borewell',
  language: 'en',
};

interface AppState {
  user: User | null;
  authReady: boolean;
  profile: FarmProfile;
  updateProfile: (patch: Partial<FarmProfile>) => void;
  crops: Crop[];
  setCrops: (c: Crop[]) => void;
  expenses: Expense[];
  addExpense: (e: Omit<Expense, 'id'>) => void;
  lang: LangCode;
  changeLanguage: (c: LangCode) => void;
  isOnline: boolean;
  /** Auto-play spoken summaries — on by default, this is a voice-first app. */
  autoSpeak: boolean;
  setAutoSpeak: (v: boolean) => void;
  /** Speak text in the active language, respecting the autoSpeak preference. */
  say: (text: string, opts?: { force?: boolean }) => void;
  hush: () => void;
  locating: boolean;
  useMyLocation: () => Promise<void>;
  dark: boolean;
  setDark: (v: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<FarmProfile>(DEFAULT_PROFILE);
  const [crops, setCropsState] = useState<Crop[]>(DEMO_CROPS);
  const [expenses, setExpenses] = useState<Expense[]>(DEMO_EXPENSES);
  const [lang, setLang] = useState<LangCode>(savedLanguage());
  const [isOnline, setIsOnline] = useState(navigator.onLine !== false);
  const [autoSpeak, setAutoSpeakState] = useState(true);
  const [locating, setLocating] = useState(false);
  const [dark, setDarkState] = useState(false);
  const primed = useRef(false);

  /* -------------------------------------------------- hydrate from cache */
  useEffect(() => {
    void (async () => {
      const [p, c, e, a, d] = await Promise.all([
        readCache<FarmProfile>('profile'),
        readCache<Crop[]>('crops'),
        readCache<Expense[]>('expenses'),
        readCache<boolean>('autoSpeak'),
        readCache<boolean>('dark'),
      ]);
      if (p?.value) setProfile({ ...DEFAULT_PROFILE, ...p.value });
      if (c?.value?.length) setCropsState(c.value);
      if (e?.value?.length) setExpenses(e.value);
      if (a && typeof a.value === 'boolean') setAutoSpeakState(a.value);
      
      let initialDark = false;
      if (d && typeof d.value === 'boolean') {
         initialDark = d.value;
      }
      setDarkState(initialDark);
      document.documentElement.classList.toggle('dark', initialDark);
    })();
  }, []);

  /* ------------------------------------------------------- connectivity */
  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      // Replay anything the farmer did while offline.
      void drainOutbox(async (action) => {
        if (action.type === 'diary' && user) {
          await pushDiaryEntry(user.uid, action.payload as Record<string, unknown>);
        }
      });
    };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [user]);

  /* --------------------------------------------------------------- auth */
  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        void fetchFarmProfile<FarmProfile>(u.uid).then((remote) => {
          if (remote) setProfile((prev) => ({ ...prev, ...remote }));
        });
      }
    });
    return unsub;
  }, []);

  /* --------------------------------- prime speech on first user gesture */
  useEffect(() => {
    const handler = () => {
      if (primed.current) return;
      primed.current = true;
      primeSpeech();
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<FarmProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        void writeCache('profile', next);
        if (user) void syncFarmProfile(user.uid, next);
        return next;
      });
    },
    [user],
  );

  const setCrops = useCallback((c: Crop[]) => {
    setCropsState(c);
    void writeCache('crops', c);
  }, []);

  const addExpense = useCallback((e: Omit<Expense, 'id'>) => {
    setExpenses((prev) => {
      const next = [{ ...e, id: `x${Date.now()}` }, ...prev];
      void writeCache('expenses', next);
      return next;
    });
  }, []);

  const changeLanguage = useCallback(
    (code: LangCode) => {
      stopSpeaking();
      setLang(code);
      setLanguage(code);
      void i18n.changeLanguage(code);
      updateProfile({ language: code });
    },
    [i18n, updateProfile],
  );

  const setAutoSpeak = useCallback((v: boolean) => {
    setAutoSpeakState(v);
    void writeCache('autoSpeak', v);
    if (!v) stopSpeaking();
  }, []);

  const setDark = useCallback((v: boolean) => {
    setDarkState(v);
    void writeCache('dark', v);
    document.documentElement.classList.toggle('dark', v);
  }, []);

  const say = useCallback(
    (text: string, opts?: { force?: boolean }) => {
      if (!autoSpeak && !opts?.force) return;
      ttsSpeak(text, lang);
    },
    [autoSpeak, lang],
  );

  const useMyLocation = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      alert(t('locationError', { defaultValue: 'Unable to get location. Please check browser permissions or try again.' }));
      return;
    }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 10 * 60 * 1000,
        });
      });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      
      const patch: Partial<FarmProfile> = { lat, lon };
      
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          const addr = data.address;
          if (addr) {
            const village = addr.village || addr.town || addr.city || addr.suburb || addr.hamlet;
            const district = addr.state_district || addr.county || addr.region;
            if (village) patch.village = village;
            if (district) patch.district = district.replace(/ district$/i, '').trim();
            if (addr.state) patch.state = addr.state;
          }
        }
      } catch (geoErr) {
        console.error('Reverse geocode failed:', geoErr);
      }
      
      updateProfile(patch);
    } catch (err) {
      alert(t('locationError', { defaultValue: 'Unable to get location. Please check permissions or try again.' }));
      /* permission denied or unavailable — keep the saved location */
    } finally {
      setLocating(false);
    }
  }, [updateProfile, t]);

  const value = useMemo<AppState>(
    () => ({
      user,
      authReady,
      profile,
      updateProfile,
      crops,
      setCrops,
      expenses,
      addExpense,
      lang,
      changeLanguage,
      isOnline,
      autoSpeak,
      setAutoSpeak,
      say,
      hush: stopSpeaking,
      locating,
      useMyLocation,
      dark,
      setDark,
    }),
    [
      user,
      authReady,
      profile,
      updateProfile,
      crops,
      setCrops,
      expenses,
      addExpense,
      lang,
      changeLanguage,
      isOnline,
      autoSpeak,
      setAutoSpeak,
      say,
      locating,
      useMyLocation,
      dark,
      setDark,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
