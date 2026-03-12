/**
 * In-memory cache with TTL for API responses. Reduces repeated calls (getReferralInfo, getBankingConfig, etc.).
 */

const CACHE_TTL_MS = {
  /** Referral info: 90s so balance/commission updates within ~1.5 min */
  referralInfo: 90 * 1000,
  /** Banking config: 5 min (admin rarely changes) */
  bankingConfig: 5 * 60 * 1000,
  /** Categories: 10 min */
  categories: 10 * 60 * 1000,
  /** Sliders: 10 min */
  sliders: 10 * 60 * 1000,
} as const;

type CacheKey = keyof typeof CACHE_TTL_MS;

interface Entry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<CacheKey, Entry<unknown>>();

function get<T>(key: CacheKey): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

function set<T>(key: CacheKey, data: T): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS[key],
  });
}

/** Clear one key (e.g. after logout so next login gets fresh referralInfo). */
export function invalidateCache(key?: CacheKey): void {
  if (key) store.delete(key);
  else store.clear();
}

export const apiCache = {
  get,
  set,
  invalidate: invalidateCache,
  TTL: CACHE_TTL_MS,
};
