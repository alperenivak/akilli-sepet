// =====================================================
// Offline onbellek — bellek (Expo Go uyumlu)
// =====================================================

type StorageLike = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
};

const mem = new Map<string, string>();
const storage: StorageLike = {
  getString: (k) => mem.get(k),
  set: (k, v) => { mem.set(k, v); },
};

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 saat

function cacheKey(prefix: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return prefix;
  return `${prefix}:${JSON.stringify(params)}`;
}

export function setOfflineCache<T>(
  prefix: string,
  params: Record<string, unknown> | undefined,
  data: T,
): void {
  try {
    storage.set(cacheKey(prefix, params), JSON.stringify({ data, at: Date.now() }));
  } catch {
    // onbellek yazilamazsa sessizce devam et
  }
}

export function getOfflineCache<T>(
  prefix: string,
  params?: Record<string, unknown>,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): T | null {
  try {
    const raw = storage.getString(cacheKey(prefix, params));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; at: number };
    if (Date.now() - parsed.at > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
