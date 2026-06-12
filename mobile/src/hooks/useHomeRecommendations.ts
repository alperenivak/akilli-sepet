// =====================================================
// Ana sayfa kişisel öneriler — baktığın ürünler + benzerleri
// =====================================================

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useViewHistoryStore } from '../store/viewHistoryStore';
import { useCartStore, EMPTY_CART_ITEMS } from '../store/cartStore';
import { getProduct, getProducts } from '../api/products';
import { Product } from '../types/api';
import {
  rankViewRecords, getDominantCategoryId, sectionPitch, ScoredView, IntentBadge,
} from '../utils/purchaseIntent';

export interface RecommendedProduct {
  product: Product;
  badge?: IntentBadge;
  pitch?: string;
}

async function refreshProducts(ids: string[]): Promise<Product[]> {
  const results = await Promise.allSettled(ids.map((id) => getProduct(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<Product> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export function useHomeRecommendations() {
  const records = useViewHistoryStore((s) => s.records);
  const hydrated = useViewHistoryStore((s) => s.hydrated);
  const cartItems = useCartStore((s) => s.cart?.items ?? EMPTY_CART_ITEMS);

  const cartProductIds = useMemo(
    () => new Set(cartItems.map((i) => i.productId)),
    [cartItems],
  );

  const preliminaryScored = useMemo(
    () => rankViewRecords(records, cartProductIds),
    [records, cartProductIds],
  );

  const topViewedIds = useMemo(
    () => preliminaryScored.slice(0, 8).map((s) => s.record.productId),
    [preliminaryScored],
  );

  const dominantCategory = useMemo(() => getDominantCategoryId(records), [records]);

  const viewedQuery = useQuery({
    queryKey: ['home-viewed-products', topViewedIds],
    queryFn: () => refreshProducts(topViewedIds),
    enabled: hydrated && topViewedIds.length > 0,
    staleTime: 60_000,
  });

  const relatedQuery = useQuery({
    queryKey: ['home-related-products', dominantCategory, topViewedIds],
    queryFn: () => getProducts({ categoryId: dominantCategory, limit: 14 }),
    enabled: hydrated && !!dominantCategory,
    staleTime: 120_000,
    select: (data) =>
      data.items.filter((p) => !topViewedIds.includes(p.id)).slice(0, 8),
  });

  const scoredWithPrices = useMemo(() => {
    if (!viewedQuery.data?.length) return preliminaryScored;
    const priceMap = new Map<string, number>();
    viewedQuery.data.forEach((p) => {
      if (p.lowestPrice != null) priceMap.set(p.id, p.lowestPrice);
    });
    return rankViewRecords(records, cartProductIds, priceMap);
  }, [viewedQuery.data, records, cartProductIds, preliminaryScored]);

  const scoredMap = useMemo(() => {
    const m = new Map<string, ScoredView>();
    scoredWithPrices.forEach((s) => m.set(s.record.productId, s));
    return m;
  }, [scoredWithPrices]);

  const viewedProducts: RecommendedProduct[] = useMemo(() => {
    if (!viewedQuery.data) return [];
    const orderIds = scoredWithPrices
      .filter((s) => topViewedIds.includes(s.record.productId))
      .map((s) => s.record.productId);
    const byId = new Map(viewedQuery.data.map((p) => [p.id, p]));
    return orderIds
      .map((id) => {
        const product = byId.get(id);
        if (!product) return null;
        const scored = scoredMap.get(id);
        return {
          product,
          badge: scored?.badge,
          pitch: scored?.badge.pitch,
        };
      })
      .filter((x): x is RecommendedProduct => x != null);
  }, [viewedQuery.data, scoredWithPrices, scoredMap, topViewedIds]);

  const relatedProducts: RecommendedProduct[] = useMemo(
    () => (relatedQuery.data ?? []).map((product) => ({ product })),
    [relatedQuery.data],
  );

  const pitch = sectionPitch(scoredWithPrices);
  const hasHistory = records.length > 0;
  const isLoading = hasHistory && (viewedQuery.isLoading || relatedQuery.isLoading);

  const refetch = useCallback(() => {
    void viewedQuery.refetch();
    void relatedQuery.refetch();
  }, [viewedQuery.refetch, relatedQuery.refetch]);

  return {
    hasHistory,
    hydrated,
    pitch,
    viewedProducts,
    relatedProducts,
    isLoading,
    isError: viewedQuery.isError,
    refetch,
  };
}
