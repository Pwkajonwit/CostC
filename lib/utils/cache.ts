// High-performance in-memory cache for Supabase reads
// Fast response times with automatic stampede-protection and LRU eviction

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();
const MAX_CACHE_ENTRIES = 1000;

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  if (ttlMs <= 0) {
    return loader();
  }

  const now = Date.now();
  const existing = memoryCache.get(key);
  
  if (existing && existing.expiresAt > now) {
    // LRU refresh: re-insert so it remains recently used
    memoryCache.delete(key);
    memoryCache.set(key, existing);
    return existing.data as T;
  }

  // Stampede protection: Deduplicate concurrent in-flight requests for the exact same key
  const pending = inFlightPromises.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const loaderPromise = (async () => {
    try {
      const data = await loader();

      // Enforce max capacity with LRU eviction
      if (memoryCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        if (oldestKey) memoryCache.delete(oldestKey);
      }

      memoryCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs
      });

      return data;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, loaderPromise);
  return loaderPromise;
}

export function clearCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear();
    inFlightPromises.clear();
    return;
  }
  
  const rawPrefixLower = prefix.toLowerCase();
  const basePrefix = rawPrefixLower.replace(/s$/, "");
  for (const key of Array.from(memoryCache.keys())) {
    const keyLower = key.toLowerCase();
    const baseKey = keyLower.replace(/s(?=:|$)/g, "");
    if (
      key === prefix ||
      keyLower.startsWith(rawPrefixLower) ||
      keyLower.includes(rawPrefixLower) ||
      baseKey.includes(basePrefix) ||
      keyLower.includes(basePrefix)
    ) {
      memoryCache.delete(key);
      inFlightPromises.delete(key);
    }
  }
}

export function getCacheStats() {
  return {
    size: memoryCache.size,
    maxSize: MAX_CACHE_ENTRIES,
    inFlight: inFlightPromises.size
  };
}

export function revalidateAllBillViews() {
  clearCache("rows:bills");
  clearCache("rows:Data");
  clearCache("rows:DATA");
  clearCache("rows:data");
  clearCache("bills:withdraw");
  clearCache("bills:bill_follow");
  clearCache("headers:bills");
  clearCache("headers:Data");
  clearCache("dashboard");
  clearCache("summary:fin");

  const routes = [
    "/bills",
    "/withdraw-request",
    "/bill-follow",
    "/work-status",
    "/reports",
    "/project-analytics",
    "/documents",
    "/"
  ];
  for (const route of routes) {
    try {
      const { revalidatePath } = require("next/cache");
      revalidatePath(route);
    } catch {}
  }
  try {
    const { revalidatePath } = require("next/cache");
    revalidatePath("/", "layout");
  } catch {}
}
