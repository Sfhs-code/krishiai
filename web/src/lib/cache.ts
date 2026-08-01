import { get, set, del, keys } from 'idb-keyval';

/**
 * Offline-first cache. Every network read in the app goes through
 * `cachedFetch`, which returns cached data instantly when the device is
 * offline or the request fails — the "works without network" promise on the
 * home screen has to be literally true.
 *
 * On React Native this file is the seam that gets swapped for expo-sqlite;
 * the public surface (read/write/cachedFetch) stays identical.
 */

type Entry<T> = { value: T; savedAt: number };

const MEM = new Map<string, Entry<unknown>>();

export async function readCache<T>(key: string): Promise<Entry<T> | null> {
  const hit = MEM.get(key);
  if (hit) return hit as Entry<T>;
  try {
    const stored = (await get<Entry<T>>(`ks:${key}`)) ?? null;
    if (stored) MEM.set(key, stored);
    return stored;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const entry: Entry<T> = { value, savedAt: Date.now() };
  MEM.set(key, entry);
  try {
    await set(`ks:${key}`, entry);
  } catch {
    /* storage full or blocked — memory cache still serves this session */
  }
}

export async function clearCache(): Promise<void> {
  MEM.clear();
  try {
    const all = await keys();
    await Promise.all(all.filter((k) => String(k).startsWith('ks:')).map((k) => del(k)));
  } catch {
    /* ignore */
  }
}

export async function cacheSize(): Promise<number> {
  try {
    const all = await keys();
    return all.filter((k) => String(k).startsWith('ks:')).length;
  } catch {
    return MEM.size;
  }
}

export type CachedResult<T> = {
  data: T;
  /** true when the value came from cache rather than the network */
  stale: boolean;
  savedAt: number | null;
};

/**
 * Fetch with a cache fallback.
 * - Fresh cache (within `maxAgeMs`) short-circuits the network entirely.
 * - A network failure falls back to *any* cached value, however old.
 * - `fallback` is the last resort so a screen never renders empty.
 */
export async function cachedFetch<T>(
  key: string,
  loader: () => Promise<T>,
  opts: { maxAgeMs?: number; fallback?: T } = {},
): Promise<CachedResult<T>> {
  const { maxAgeMs = 15 * 60 * 1000, fallback } = opts;
  const cached = await readCache<T>(key);

  const offline = navigator.onLine === false;

  if (cached && Date.now() - cached.savedAt < maxAgeMs && !offline) {
    return { data: cached.value, stale: false, savedAt: cached.savedAt };
  }

  if (offline) {
    if (cached) return { data: cached.value, stale: true, savedAt: cached.savedAt };
    if (fallback !== undefined) return { data: fallback, stale: true, savedAt: null };
    throw new Error('offline-no-cache');
  }

  try {
    const fresh = await loader();
    await writeCache(key, fresh);
    return { data: fresh, stale: false, savedAt: Date.now() };
  } catch (err) {
    if (cached) return { data: cached.value, stale: true, savedAt: cached.savedAt };
    if (fallback !== undefined) return { data: fallback, stale: true, savedAt: null };
    throw err;
  }
}

/** Queue of actions taken while offline, replayed when connectivity returns. */
const OUTBOX = 'outbox';

export async function enqueueOutbox(action: { type: string; payload: unknown }): Promise<void> {
  const current = (await readCache<{ type: string; payload: unknown; at: number }[]>(OUTBOX))?.value ?? [];
  await writeCache(OUTBOX, [...current, { ...action, at: Date.now() }]);
}

export async function drainOutbox(
  handler: (action: { type: string; payload: unknown }) => Promise<void>,
): Promise<number> {
  const current = (await readCache<{ type: string; payload: unknown }[]>(OUTBOX))?.value ?? [];
  if (!current.length) return 0;
  const failed: typeof current = [];
  for (const action of current) {
    try {
      await handler(action);
    } catch {
      failed.push(action);
    }
  }
  await writeCache(OUTBOX, failed);
  return current.length - failed.length;
}
