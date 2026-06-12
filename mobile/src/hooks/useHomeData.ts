// =====================================================
// Akıllı Sepet - Ana Sayfa Veri Hook'u
// Tum ana sayfa sorgularini tek yerde toplar
// =====================================================

import { useCallback } from 'react';
import { useCategories, useProducts } from './useProducts';
import { useMarkets, useActiveCatalogs } from './useMarkets';

export function useHomeData() {
  const {
    data: categoriesData,
    isLoading: catsLoading,
  } = useCategories();

  const {
    data: productsData,
    isLoading: prodsLoading,
    refetch: refetchProds,
  } = useProducts({ limit: 10 });

  const {
    data: markets,
    isLoading: marketsLoading,
    refetch: refetchMarkets,
  } = useMarkets();

  const {
    data: catalogs,
    refetch: refetchCatalogs,
  } = useActiveCatalogs();

  const isLoading = catsLoading || prodsLoading || marketsLoading;

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchProds(), refetchMarkets(), refetchCatalogs()]);
  }, [refetchProds, refetchMarkets, refetchCatalogs]);

  return {
    categories: categoriesData ?? [],
    products: productsData?.items ?? [],
    markets: markets ?? [],
    catalogs: catalogs ?? [],
    isLoading,
    refetchAll,
  };
}
