// =====================================================
// Urun ve Kategori React Query Hook'lari
// =====================================================

// useInfiniteQuery: sonsuz scroll ozelligi eklendiginde kullanilacak
import { useQuery } from '@tanstack/react-query';
import {
  getProducts, getProduct, getProductByBarcode,
  getCategories, getProductPrices, getPriceHistory, ProductsQuery,
} from '../api/products';

export const QUERY_KEYS = {
  products: (params: ProductsQuery) => ['products', params] as const,
  product: (id: string) => ['product', id] as const,
  productBarcode: (code: string) => ['product-barcode', code] as const,
  categories: ['categories'] as const,
  productPrices: (id: string) => ['product-prices', id] as const,
  priceHistory: (productId: string, marketId: string) =>
    ['price-history', productId, marketId] as const,
};

export function useProducts(params: ProductsQuery = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.products(params),
    queryFn: () => getProducts(params),
    staleTime: 2 * 60 * 1000, // 2 dakika
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.product(id),
    queryFn: () => getProduct(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useProductByBarcode(code: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.productBarcode(code ?? ''),
    queryFn: () => getProductByBarcode(code!),
    enabled: !!code,
    retry: 1,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn: getCategories,
    staleTime: 10 * 60 * 1000, // 10 dakika
  });
}

export function useProductPrices(productId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.productPrices(productId),
    queryFn: () => getProductPrices(productId),
    enabled: !!productId,
    staleTime: 60 * 1000,
  });
}

export function usePriceHistory(productId: string, marketId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.priceHistory(productId, marketId ?? ''),
    queryFn: () => getPriceHistory(productId, marketId!),
    enabled: !!productId && !!marketId,
    staleTime: 5 * 60 * 1000,
  });
}
