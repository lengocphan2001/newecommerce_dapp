/**
 * In-memory cache with TTL for API responses. Reduces repeated calls (getReferralInfo, getBankingConfig, etc.).
 */

const CACHE_TTL_MS = {
  /** Referral info: 90s so balance/commission updates within ~1.5 min */
  referralInfo: 90 * 1000,
  referralInfo_compact: 90 * 1000,
  /** Banking config: 5 min (admin rarely changes) */
  bankingConfig: 5 * 60 * 1000,
  /** Categories: 10 min */
  categories: 10 * 60 * 1000,
  /** Sliders: 10 min */
  sliders: 10 * 60 * 1000,
  /** Products list (keyed by country_categoryId): 10 min */
  products: 10 * 60 * 1000,
  /** Reconsumption check status: 90s. Para evitar llamadas repetidas al montar la cabecera en cada navegación */
  checkReconsumption: 90 * 1000,
  /** Profile summary: 90s. Evita consultar el perfil constantemente durante la sesión */
  profile: 90 * 1000,
  /** Featured products: 5 min. Optimiza la carga de la página de inicio al almacenar en caché los productos destacados */
  featuredProducts: 5 * 60 * 1000,
} as const;

type CacheKey = keyof typeof CACHE_TTL_MS;

interface Entry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<CacheKey, Entry<unknown>>();

/** Keyed cache for products: key = "country_categoryId" (e.g. "VIETNAM_all", "USA_xyz") */
const productsStore = new Map<string, Entry<unknown>>();
const PRODUCTS_TTL_MS = 10 * 60 * 1000;

/** Keyed cache for the binary tree: key = "<rootUserId>_<maxDepth>". Short TTL because
 *  the tree changes whenever a new member joins the downline. */
const treeStore = new Map<string, Entry<unknown>>();
const TREE_TTL_MS = 30 * 1000;

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

function getProductsKeyed(key: string): unknown | null {
  const entry = productsStore.get(key) as Entry<unknown> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    productsStore.delete(key);
    return null;
  }
  return entry.data;
}

function setProductsKeyed(key: string, data: unknown): void {
  productsStore.set(key, {
    data,
    expiresAt: Date.now() + PRODUCTS_TTL_MS,
  });
}

function getTreeKeyed(key: string): unknown | null {
  const entry = treeStore.get(key) as Entry<unknown> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    treeStore.delete(key);
    return null;
  }
  return entry.data;
}

function setTreeKeyed(key: string, data: unknown): void {
  treeStore.set(key, {
    data,
    expiresAt: Date.now() + TREE_TTL_MS,
  });
}

/** Clear one key (e.g. after logout so next login gets fresh referralInfo). */
export function invalidateCache(key?: CacheKey): void {
  if (key) {
    store.delete(key);
    if (key === 'referralInfo') {
      store.delete('referralInfo_compact');
      treeStore.clear();
    }
  } else {
    store.clear();
    productsStore.clear();
    treeStore.clear();
  }
}

export const apiCache = {
  get,
  set,
  invalidate: invalidateCache,
  TTL: CACHE_TTL_MS,
  /** Keyed cache for products list (key = "country_categoryId") */
  getProducts: getProductsKeyed,
  setProducts: setProductsKeyed,
  /** Keyed cache for the binary tree (key = "<rootUserId>_<maxDepth>") */
  getTree: getTreeKeyed,
  setTree: setTreeKeyed,
};
