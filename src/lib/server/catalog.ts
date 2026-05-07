import "server-only";
import type { CatalogProduct } from "../match";

const CATALOG_URL = "https://api.cashercollection.com/products";
const TTL_MS = 30 * 60 * 1000;
const REFRESH_MS = 30 * 60 * 1000;

interface CacheState {
  data: CatalogProduct[];
  fetchedAt: number;
  lastErrorAt: number;
  lastError: string | null;
  fetching: Promise<CatalogProduct[]> | null;
  refreshTimer: ReturnType<typeof setInterval> | null;
}

const g = globalThis as unknown as { __catalogCache?: CacheState };
g.__catalogCache ??= {
  data: [],
  fetchedAt: 0,
  lastErrorAt: 0,
  lastError: null,
  fetching: null,
  refreshTimer: null,
};
const cache = g.__catalogCache;

async function load(): Promise<CatalogProduct[]> {
  try {
    const res = await fetch(CATALOG_URL, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const data = (await res.json()) as CatalogProduct[];
    cache.data = Array.isArray(data) ? data : [];
    cache.fetchedAt = Date.now();
    cache.lastError = null;
    return cache.data;
  } catch (err) {
    cache.lastErrorAt = Date.now();
    cache.lastError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export async function getCatalog(force = false): Promise<CatalogProduct[]> {
  ensureAutoRefresh();
  const fresh = Date.now() - cache.fetchedAt < TTL_MS;
  if (cache.data.length && fresh && !force) return cache.data;
  if (cache.fetching) return cache.fetching;
  cache.fetching = load().finally(() => {
    cache.fetching = null;
  });
  try {
    return await cache.fetching;
  } catch (err) {
    console.error("[catalog] load failed:", err);
    return cache.data;
  }
}

function ensureAutoRefresh() {
  if (cache.refreshTimer) return;
  cache.refreshTimer = setInterval(() => {
    if (cache.fetching) return;
    cache.fetching = load().finally(() => {
      cache.fetching = null;
    });
    cache.fetching.catch((err) => {
      console.error("[catalog] auto-refresh failed:", err);
    });
  }, REFRESH_MS);
  if (typeof cache.refreshTimer === "object" && cache.refreshTimer) {
    const t = cache.refreshTimer as unknown as { unref?: () => void };
    t.unref?.();
  }
}

export function getCatalogMeta() {
  const ok =
    cache.fetchedAt > 0 &&
    (!cache.lastErrorAt || cache.fetchedAt >= cache.lastErrorAt);
  return {
    size: cache.data.length,
    fetchedAt: cache.fetchedAt,
    age: cache.fetchedAt ? Date.now() - cache.fetchedAt : null,
    lastErrorAt: cache.lastErrorAt || null,
    lastError: cache.lastError,
    ok,
  };
}
