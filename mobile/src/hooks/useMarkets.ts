import { useQuery } from '@tanstack/react-query';
import { getMarkets, getMarket, getActiveCatalogs, getCatalog } from '../api/markets';

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: getMarkets,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarket(id: string) {
  return useQuery({
    queryKey: ['market', id],
    queryFn: () => getMarket(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useActiveCatalogs(marketId?: string) {
  return useQuery({
    queryKey: ['catalogs', 'active', marketId],
    queryFn: () => getActiveCatalogs(marketId),
    staleTime: 60 * 1000, // 1 dakika — kataloglar sık güncellenir
  });
}

export function useCatalog(id: string) {
  return useQuery({
    queryKey: ['catalog', id],
    queryFn: () => getCatalog(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 dakika
  });
}
