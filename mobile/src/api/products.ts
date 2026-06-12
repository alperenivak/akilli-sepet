import api from './client';
import { Product, Category, Price, PriceHistory, PaginatedResponse } from '../types/api';
import { getOfflineCache, setOfflineCache } from '../utils/offlineCache';

export interface ProductsQuery {
  search?: string;
  categoryId?: string;
  brand?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt';
}

// Urun listesi — isActive:true varsayılan olarak geçirilir (sadece aktif ürünler)
export const getProducts = async (params: ProductsQuery = {}): Promise<PaginatedResponse<Product>> => {
  const queryParams = { isActive: true, ...params };
  try {
    const res = await api.get<{ data: PaginatedResponse<Product> } | PaginatedResponse<Product>>(
      '/products',
      { params: queryParams },
    );
    const body = res.data as { data?: PaginatedResponse<Product> } & PaginatedResponse<Product>;
    const result = body && typeof body === 'object' && 'items' in body && Array.isArray(body.items)
      ? (body as PaginatedResponse<Product>)
      : (body as { data: PaginatedResponse<Product> }).data;
    setOfflineCache('products', queryParams, result);
    return result;
  } catch (err) {
    const cached = getOfflineCache<PaginatedResponse<Product>>('products', queryParams);
    if (cached) return cached;
    throw err;
  }
};

// Urun detayi
export const getProduct = (id: string) =>
  api.get<{ data: Product }>(`/products/${id}`)
     .then((r) => r.data.data);

// Barkod ile urun bul — 404 ise null (urun yok)
export const getProductByBarcode = async (code: string): Promise<Product | null> => {
  try {
    const res = await api.get<{ data: Product }>(
      `/products/barcode/${encodeURIComponent(code.trim())}`,
    );
    return res.data.data;
  } catch (err) {
    if ((err as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw err;
  }
};

// Kategoriler
export const getCategories = async (): Promise<Category[]> => {
  const res = await api.get<{ data: Category[] } | Category[]>('/products/categories');
  const body = res.data;
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && 'data' in body && Array.isArray((body as { data: Category[] }).data)) {
    return (body as { data: Category[] }).data;
  }
  return [];
};

// Urune ait fiyatlar
export const getProductPrices = (productId: string) =>
  api.get<{ data: { prices: Price[] } }>(`/prices/product/${productId}`)
     .then((r) => r.data.data);

// Fiyat gecmisi
export const getPriceHistory = (productId: string, marketId: string) =>
  api.get<{ data: { history: PriceHistory[] } }>(
    `/prices/product/${productId}/market/${marketId}/history`,
  ).then((r) => r.data.data);
