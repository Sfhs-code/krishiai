import { CONFIG, hasMandi } from './config';

export type Signal = 'green' | 'yellow' | 'red';

export interface MandiPrice {
  id: string;
  commodity: string;
  emoji: string;
  market: string;
  district: string;
  state: string;
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  changePct: number;
  unit: string;
  arrivalTonnes?: number;
  congestion: Signal;
  waitMinutes: number;
  distanceKm: number;
  updatedAt: string;
}

const EMOJI: Record<string, string> = {
  wheat: '🌾', rice: '🍚', paddy: '🌾', onion: '🧅', tomato: '🍅', potato: '🥔',
  cotton: '🪴', soyabean: '🫘', soybean: '🫘', gram: '🌰', maize: '🌽', bajra: '🌾',
  jowar: '🌾', sugarcane: '🎋', groundnut: '🥜', mustard: '🌻', turmeric: '🟡',
  chilli: '🌶️', banana: '🍌', mango: '🥭', brinjal: '🍆', cabbage: '🥬',
};

const emojiFor = (name: string) => {
  const key = name.toLowerCase().trim();
  return EMOJI[key] ?? Object.entries(EMOJI).find(([k]) => key.includes(k))?.[1] ?? '🌾';
};

interface AgmarknetRecord {
  state?: string;
  district?: string;
  market?: string;
  commodity?: string;
  variety?: string;
  arrival_date?: string;
  min_price?: string;
  max_price?: string;
  modal_price?: string;
}

export class NoMandiKey extends Error {
  constructor() {
    super('data-gov-key-missing');
  }
}

/**
 * Live Agmarknet prices from data.gov.in.
 *
 * Arrivals drive the congestion signal: a yard receiving far more produce than
 * usual is where farmers end up queueing for hours, and that is exactly the
 * thing a farmer needs to know *before* loading the tractor.
 */
export async function fetchMandi(state: string, commodities: string[]): Promise<MandiPrice[]> {
  if (!hasMandi()) throw new NoMandiKey();

  const url = new URL(`https://api.data.gov.in/resource/${CONFIG.dataGovResource}`);
  url.searchParams.set('api-key', CONFIG.dataGovKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '200');
  if (state) url.searchParams.set('filters[state.keyword]', state);

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`datagov-${res.status}`);

  const json = (await res.json()) as { records?: AgmarknetRecord[] };
  const records = json.records ?? [];
  if (!records.length) throw new Error('datagov-empty');

  const wanted = commodities.map((c) => c.toLowerCase()).filter(Boolean);

  // Keep the farmer's own crops first, then fill up with whatever the yard has.
  const scored = records
    .filter((r) => r.commodity && r.market && r.modal_price)
    .map((r) => {
      const commodity = r.commodity!.trim();
      const isMine = wanted.some((w) => commodity.toLowerCase().includes(w) || w.includes(commodity.toLowerCase()));
      return { r, commodity, isMine };
    })
    .sort((a, b) => Number(b.isMine) - Number(a.isMine));

  // One row per commodity + market pair.
  const seen = new Set<string>();
  const out: MandiPrice[] = [];

  for (const { r, commodity } of scored) {
    const key = `${commodity}|${r.market}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const modal = Number(r.modal_price) || 0;
    const min = Number(r.min_price) || modal;
    const max = Number(r.max_price) || modal;
    if (!modal) continue;

    // The open dataset carries no arrival volume on every row, so congestion is
    // inferred from the price spread: a wide min–max band at a yard means heavy,
    // mixed arrivals and long waits at the auction.
    const spread = modal > 0 ? (max - min) / modal : 0;
    const congestion: Signal = spread > 0.35 ? 'red' : spread > 0.18 ? 'yellow' : 'green';
    const waitMinutes = congestion === 'red' ? 150 + Math.round(spread * 100) : congestion === 'yellow' ? 80 : 25;

    out.push({
      id: `${commodity}-${r.market}`.toLowerCase().replace(/\s+/g, '-'),
      commodity,
      emoji: emojiFor(commodity),
      market: r.market!.trim(),
      district: r.district?.trim() ?? '',
      state: r.state?.trim() ?? state,
      modalPrice: modal,
      minPrice: min,
      maxPrice: max,
      // The open dataset has no previous-day column, so the day's own spread
      // stands in for momentum. Replace with a stored history for a true delta.
      changePct: Number((((modal - (min + max) / 2) / modal) * 100).toFixed(1)),
      unit: 'quintal',
      congestion,
      waitMinutes,
      distanceKm: 0,
      updatedAt: r.arrival_date ?? 'today',
    });

    if (out.length >= 12) break;
  }

  if (!out.length) throw new Error('datagov-no-usable-rows');
  return out;
}
