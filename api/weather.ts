import { CONFIG, hasWeather } from './config';

/** Mirrors the frontend `WeatherBundle` type. */
export interface WeatherBundle {
  now: {
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windKph: number;
    rainChance: number;
    condition: string;
    icon: string;
    place: string;
    sunrise?: number;
    sunset?: number;
  };
  forecast: {
    day: string;
    date: string;
    maxC: number;
    minC: number;
    rainChance: number;
    condition: string;
    icon: string;
  }[];
  irrigation: {
    signal: 'green' | 'yellow' | 'red';
    /**
     * Machine-readable verdict. The client renders its own localised text from
     * this plus `rainChance`/`tempC`, so the headline the farmer *hears* is in
     * their language. `headline`/`detail` below are the English fallback for
     * any client that does not know the kind.
     */
    kind: 'skip' | 'wait' | 'urgent' | 'normal';
    rainChance: number;
    tempC: number;
    humidity: number;
    headline: string;
    detail: string;
    litresSaved: number;
  };
}

const OWM_LANG: Record<string, string> = { en: 'en', hi: 'hi', mr: 'mr', pa: 'en', ta: 'ta', bn: 'bn' };

interface OwmCurrent {
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number };
  weather: { description: string; icon: string; main: string }[];
  name: string;
  sys: { country: string; sunrise: number; sunset: number };
  rain?: { '1h'?: number };
}

interface OwmForecast {
  list: {
    dt: number;
    main: { temp: number; temp_max: number; temp_min: number };
    pop: number;
    weather: { description: string; icon: string }[];
  }[];
  city: { name: string; country: string };
}

export class NoWeatherKey extends Error {
  constructor() {
    super('openweather-key-missing');
  }
}

export async function fetchWeather(lat: number, lon: number, lang: string): Promise<WeatherBundle> {
  if (!hasWeather()) throw new NoWeatherKey();

  const l = OWM_LANG[lang] ?? 'en';
  const base = 'https://api.openweathermap.org/data/2.5';
  const q = `lat=${lat}&lon=${lon}&units=metric&lang=${l}&appid=${CONFIG.openWeatherKey}`;

  const [curRes, fcRes] = await Promise.all([fetch(`${base}/weather?${q}`), fetch(`${base}/forecast?${q}`)]);

  if (!curRes.ok) throw new Error(`openweather-${curRes.status}`);
  const cur = (await curRes.json()) as OwmCurrent;
  const fc = fcRes.ok ? ((await fcRes.json()) as OwmForecast) : null;

  /* --------------------------------------------------------------- forecast */
  // The free 5-day endpoint returns 3-hourly slots; collapse them into days.
  const byDay = new Map<string, { max: number; min: number; pop: number; icons: string[]; desc: string[] }>();
  for (const slot of fc?.list ?? []) {
    const d = new Date(slot.dt * 1000);
    const key = d.toISOString().slice(0, 10);
    const b = byDay.get(key) ?? { max: -99, min: 99, pop: 0, icons: [], desc: [] };
    b.max = Math.max(b.max, slot.main.temp_max);
    b.min = Math.min(b.min, slot.main.temp_min);
    b.pop = Math.max(b.pop, slot.pop ?? 0);
    // Prefer a midday icon — it reads as "the weather that day".
    if (d.getUTCHours() >= 6 && d.getUTCHours() <= 12) {
      b.icons.unshift(slot.weather[0]?.icon ?? '01d');
      b.desc.unshift(slot.weather[0]?.description ?? '');
    } else {
      b.icons.push(slot.weather[0]?.icon ?? '01d');
      b.desc.push(slot.weather[0]?.description ?? '');
    }
    byDay.set(key, b);
  }

  const today = new Date().toISOString().slice(0, 10);
  const forecast = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5)
    .map(([key, b], i) => ({
      day: key === today ? 'Today' : new Date(key).toLocaleDateString('en-IN', { weekday: 'short' }),
      date: key,
      maxC: Math.round(b.max),
      minC: Math.round(b.min),
      rainChance: Math.round(b.pop * 100),
      condition: capitalise(b.desc[0] ?? ''),
      icon: b.icons[0] ?? (i === 0 ? cur.weather[0]?.icon ?? '01d' : '01d'),
    }));

  const rainChanceToday = forecast[0]?.rainChance ?? (cur.rain?.['1h'] ? 70 : 10);

  /* ------------------------------------------------------------- irrigation */
  const irrigation = irrigationCall(rainChanceToday, forecast.slice(0, 2).map((f) => f.rainChance), cur.main.temp, cur.main.humidity);

  return {
    now: {
      tempC: Math.round(cur.main.temp),
      feelsLikeC: Math.round(cur.main.feels_like),
      humidity: cur.main.humidity,
      windKph: Math.round(cur.wind.speed * 3.6),
      rainChance: rainChanceToday,
      condition: capitalise(cur.weather[0]?.description ?? ''),
      icon: cur.weather[0]?.icon ?? '01d',
      place: [cur.name, cur.sys?.country].filter(Boolean).join(', '),
      sunrise: cur.sys?.sunrise,
      sunset: cur.sys?.sunset,
    },
    forecast,
    irrigation,
  };
}

/**
 * The single most valuable output on the home screen: should the farmer run
 * the pump today? Diesel and groundwater are both expensive, so a confident
 * "skip it" is worth real money.
 */
function irrigationCall(
  todayRain: number,
  next48: number[],
  tempC: number,
  humidity: number,
): WeatherBundle['irrigation'] {
  const soon = Math.max(todayRain, ...next48, 0);
  // ~4,200 L per acre-inch saved on a typical 2.5 acre block.
  const litresSaved = 4200;
  const common = { rainChance: soon, tempC: Math.round(tempC), humidity };

  if (soon >= 60) {
    return {
      ...common,
      signal: 'green',
      kind: 'skip',
      headline: 'Skip watering today',
      detail: `${soon}% chance of rain in the next 24 to 48 hours. Your field does not need irrigation — save the diesel.`,
      litresSaved,
    };
  }
  if (tempC >= 36 && humidity < 40) {
    return {
      ...common,
      signal: 'red',
      kind: 'urgent',
      headline: 'Irrigate today — heat stress',
      detail: `${Math.round(tempC)}°C with only ${humidity}% humidity and no rain expected. Water early morning or after sunset to cut evaporation.`,
      litresSaved: 0,
    };
  }
  if (soon >= 30) {
    return {
      ...common,
      signal: 'yellow',
      kind: 'wait',
      headline: 'Wait before watering',
      detail: `${soon}% chance of rain. Check again this evening — you may not need to run the pump at all.`,
      litresSaved: Math.round(litresSaved * 0.5),
    };
  }
  return {
    ...common,
    signal: 'yellow',
    kind: 'normal',
    headline: 'Normal irrigation',
    detail: 'No rain expected. Water as per your usual schedule, preferably in the early morning.',
    litresSaved: 0,
  };
}

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (!hasWeather()) throw new NoWeatherKey();
  const res = await fetch(
    `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${CONFIG.openWeatherKey}`,
  );
  if (!res.ok) throw new Error(`geocode-${res.status}`);
  const arr = (await res.json()) as { name: string; state?: string; country: string }[];
  const hit = arr[0];
  if (!hit) throw new Error('geocode-empty');
  return [hit.name, hit.state, hit.country].filter(Boolean).join(', ');
}
