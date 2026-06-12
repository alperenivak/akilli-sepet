// =====================================================
// Ürün görüntüleme geçmişi — SecureStore ile kalıcı
// =====================================================

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Product } from '../types/api';
import { snapshotFromProduct } from '../utils/purchaseIntent';

const STORAGE_KEY = 'view_history_v1';
const MAX_RECORDS = 15;

export interface ViewRecord {
  productId: string;
  viewedAt: string;
  viewCount: number;
  name: string;
  imageUrl?: string;
  categoryId?: string;
  brand?: string;
  lowestPriceAtView?: number;
  lowestPriceMarket?: string;
}

/** SecureStore limiti için kompakt depolama */
interface CompactRecord {
  i: string;
  t: number;
  c: number;
  n: string;
  g?: string;
  p?: number;
  m?: string;
  u?: string;
  b?: string;
}

function toCompact(r: ViewRecord): CompactRecord {
  return {
    i: r.productId,
    t: new Date(r.viewedAt).getTime(),
    c: r.viewCount,
    n: r.name.slice(0, 48),
    ...(r.categoryId && { g: r.categoryId }),
    ...(r.lowestPriceAtView != null && { p: r.lowestPriceAtView }),
    ...(r.lowestPriceMarket && { m: r.lowestPriceMarket.slice(0, 20) }),
    ...(r.imageUrl && { u: r.imageUrl.slice(0, 120) }),
    ...(r.brand && { b: r.brand.slice(0, 24) }),
  };
}

function fromCompact(c: CompactRecord): ViewRecord {
  return {
    productId: c.i,
    viewedAt: new Date(c.t).toISOString(),
    viewCount: c.c,
    name: c.n,
    categoryId: c.g,
    lowestPriceAtView: c.p,
    lowestPriceMarket: c.m,
    imageUrl: c.u,
    brand: c.b,
  };
}

async function persist(records: ViewRecord[]) {
  try {
    const payload = JSON.stringify(records.map(toCompact));
    if (payload.length > 1900) {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(records.slice(0, 10).map(toCompact)));
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, payload);
    }
  } catch {
    // depolama basarisiz — bellekte kalir
  }
}

interface ViewHistoryState {
  records: ViewRecord[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  trackView: (product: Product) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useViewHistoryStore = create<ViewHistoryState>((set, get) => ({
  records: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const compact = JSON.parse(raw) as CompactRecord[];
        set({ records: compact.map(fromCompact), hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  trackView: async (product: Product) => {
    const snap = snapshotFromProduct(product);
    const now = new Date().toISOString();
    const existing = get().records;
    const idx = existing.findIndex((r) => r.productId === product.id);

    let next: ViewRecord[];
    if (idx >= 0) {
      const prev = existing[idx];
      next = [...existing];
      next[idx] = {
        ...prev,
        ...snap,
        viewedAt: now,
        viewCount: prev.viewCount + 1,
        lowestPriceAtView: snap.lowestPriceAtView ?? prev.lowestPriceAtView,
      };
      next.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());
    } else {
      next = [
        { productId: product.id, viewedAt: now, viewCount: 1, ...snap },
        ...existing,
      ].slice(0, MAX_RECORDS);
    }

    set({ records: next, hydrated: true });
    await persist(next);
  },

  clearHistory: async () => {
    set({ records: [] });
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch { /* ignore */ }
  },
}));
