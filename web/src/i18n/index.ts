import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LangCode } from '../lib/types';
import { en } from './en';
import { hi } from './hi';
import { mr } from './mr';
import { pa } from './pa';
import { ta } from './ta';
import { bn } from './bn';

export const LANGUAGES: { code: LangCode; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
];

const STORAGE_KEY = 'ks:lang';

export function savedLanguage(): LangCode {
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as LangCode | null;
  if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en';
  const match = LANGUAGES.find((l) => l.code === nav);
  return match ? match.code : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en, hi, mr, pa, ta, bn },
  lng: savedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLanguage(code: LangCode): void {
  void i18n.changeLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
  } catch {
    /* ignore */
  }
}

document.documentElement.lang = savedLanguage();

export default i18n;
