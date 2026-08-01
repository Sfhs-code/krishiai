import { cachedFetch } from './cache';
import {
  DEMO_MANDI,
  DEMO_SCHEMES,
  DEMO_SOIL,
  DEMO_WEATHER,
} from './demoData';
import type {
  ChatMessage,
  Crop,
  DiagnosisResult,
  DiversificationPlan,
  FarmProfile,
  LangCode,
  MandiPrice,
  Scheme,
  Signal,
  SoilReading,
  ResiduePlan,
  VerificationResult,
  WeatherBundle,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export type UnavailableReason = 'offline' | 'no-key' | 'error';

export class ApiUnavailable extends Error {
  readonly reason: UnavailableReason;

  constructor(reason: UnavailableReason) {
    super(`api-unavailable:${reason}`);
    this.reason = reason;
  }
}

/** `navigator.onLine` is a live property; read it fresh so TS never narrows it. */
const isOffline = (): boolean => navigator.onLine === false;

async function post<T>(path: string, body: unknown, timeoutMs = 45_000): Promise<T> {
  if (isOffline()) throw new ApiUnavailable('offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 503) throw new ApiUnavailable('no-key');
    if (!res.ok) throw new ApiUnavailable('error');
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiUnavailable) throw err;
    throw new ApiUnavailable(isOffline() ? 'offline' : 'error');
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(path: string, timeoutMs = 20_000): Promise<T> {
  if (isOffline()) throw new ApiUnavailable('offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    if (res.status === 503) throw new ApiUnavailable('no-key');
    if (!res.ok) throw new ApiUnavailable('error');
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiUnavailable) throw err;
    throw new ApiUnavailable(isOffline() ? 'offline' : 'error');
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ weather */

export async function loadWeather(lat: number, lon: number, lang: LangCode) {
  return cachedFetch<WeatherBundle>(
    `weather:${lat.toFixed(2)},${lon.toFixed(2)}:${lang}`,
    () => getJson<WeatherBundle>(`/weather?lat=${lat}&lon=${lon}&lang=${lang}`),
    { maxAgeMs: 20 * 60 * 1000, fallback: DEMO_WEATHER },
  );
}

/* -------------------------------------------------------------------- mandi */

export async function loadMandi(state: string, commodities: string[], lang: LangCode) {
  const q = new URLSearchParams({ state, lang, commodities: commodities.join(',') });
  return cachedFetch<MandiPrice[]>(`mandi:${state}:${commodities.join(',')}`, () => getJson<MandiPrice[]>(`/mandi?${q}`), {
    maxAgeMs: 45 * 60 * 1000,
    fallback: DEMO_MANDI,
  });
}

/* ---------------------------------------------------------------------- ai */

export async function askAgronomist(
  question: string,
  ctx: { profile: FarmProfile; crops: Crop[]; history: ChatMessage[]; lang: LangCode },
): Promise<{ answer: string; sources?: string[] }> {
  return post<{ answer: string; sources?: string[] }>('/ai/chat', {
    question,
    lang: ctx.lang,
    profile: ctx.profile,
    crops: ctx.crops.map((c) => ({ name: c.name, stage: c.stage, areaAcre: c.areaAcre, status: c.status })),
    history: ctx.history.slice(-8).map((m) => ({ role: m.role, text: m.text })),
  });
}

export async function diagnoseLeaf(
  imageBase64: string,
  ctx: { cropHint?: string; lang: LangCode; profile: FarmProfile },
): Promise<DiagnosisResult> {
  return post<DiagnosisResult>('/ai/diagnose', {
    image: imageBase64,
    cropHint: ctx.cropHint,
    lang: ctx.lang,
    place: `${ctx.profile.district}, ${ctx.profile.state}`,
  });
}

export async function verifyInput(
  payload: { imageBase64?: string; barcode?: string; lang: LangCode },
): Promise<VerificationResult> {
  return post<VerificationResult>('/ai/verify', {
    image: payload.imageBase64,
    barcode: payload.barcode,
    lang: payload.lang,
  });
}

export async function planDiversification(
  payload: { idleAcre: number; profile: FarmProfile; lang: LangCode; budget: string },
): Promise<DiversificationPlan> {
  return post<DiversificationPlan>('/ai/diversify', payload);
}

export async function planResidue(
  payload: { cropName: string; acres: number; lang: LangCode; profile: FarmProfile },
): Promise<ResiduePlan> {
  return post<ResiduePlan>('/ai/residue', payload);
}

export async function matchSchemes(payload: {
  profile: FarmProfile;
  crops: string[];
  lang: LangCode;
}) {
  return cachedFetch<Scheme[]>(
    `schemes:${payload.profile.state}:${payload.lang}`,
    () => post<Scheme[]>('/ai/schemes', payload),
    { maxAgeMs: 24 * 60 * 60 * 1000, fallback: DEMO_SCHEMES },
  );
}

export async function loadSoil(lat: number, lon: number) {
  return cachedFetch<SoilReading>(`soil:${lat.toFixed(2)},${lon.toFixed(2)}`, () => getJson<SoilReading>(`/soil?lat=${lat}&lon=${lon}`), {
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    fallback: DEMO_SOIL,
  });
}

/* ---------------------------------------------------------- offline fallback */

/**
 * When Gemini is unreachable we still answer — from a small on-device rule
 * base. It is deliberately narrow and says so, rather than inventing advice.
 */
const OFFLINE_RULES: { match: RegExp; answer: string }[] = [
  {
    match: /(urea|nitrogen|yellow leaf|पीले पत्ते|नाइट्रोजन)/i,
    answer:
      'Yellowing of older leaves usually means nitrogen shortage. Apply 45 kg urea per acre in two splits, the first with your next irrigation. Do not spray urea on wet leaves in strong sun.',
  },
  {
    match: /(blight|फफूंद|fungus|spot|धब्बे)/i,
    answer:
      'For leaf spot and blight: remove and burn affected leaves, avoid overhead watering, and spray a copper oxychloride solution (3 g per litre) in the evening. Repeat after 10 days if new spots appear.',
  },
  {
    match: /(price|भाव|मंडी|mandi|rate)/i,
    answer:
      'Your saved mandi rates are shown on the Mandi screen. They were last updated when you had network. Open that screen to see the cached prices and the wait time at each yard.',
  },
  {
    match: /(water|irrigat|सिंचाई|पानी)/i,
    answer:
      'Check the irrigation card on the home screen before watering. If rain chance is above 60% in the next 24 hours, skip the irrigation and save the diesel.',
  },
  {
    match: /(scheme|योजना|subsidy|सब्सिडी)/i,
    answer:
      'PM-KISAN, Fasal Bima and Kisan Credit Card are the three schemes most farmers with your landholding qualify for. Open Tools → Government schemes to see your saved eligibility list.',
  },
];

export function offlineAnswer(question: string): string {
  const hit = OFFLINE_RULES.find((r) => r.match.test(question));
  if (hit) return `${hit.answer}\n\n(Saved advice — you are offline. Connect to get a full answer.)`;
  return 'You are offline right now, so I can only answer from saved advice and I do not have a saved answer for this. Your question is queued — ask me again when you have network and I will answer in full.';
}

/* ---------------------------------------------------------------- utilities */

/** Congestion → what the farmer should actually do. */
export function congestionAdvice(signal: Signal): string {
  if (signal === 'red') return 'Congested — divert to another yard';
  if (signal === 'yellow') return 'Busy — expect a wait';
  return 'Normal operations';
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await getJson<{ place: string }>(`/geo?lat=${lat}&lon=${lon}`);
    return res.place;
  } catch {
    return null;
  }
}

/** Reports whether the backend has live keys configured, for the Profile screen. */
export async function apiHealth(): Promise<{
  gemini: boolean;
  weather: boolean;
  mandi: boolean;
} | null> {
  try {
    return await getJson<{ gemini: boolean; weather: boolean; mandi: boolean }>('/health', 6000);
  } catch {
    return null;
  }
}
