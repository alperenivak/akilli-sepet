import api from './client';
import { Cart, CartOptimizationResult } from '../types/api';

// Girisli kullanici sepeti
export const getCart = () =>
  api.get<{ data: Cart }>('/carts').then((r) => r.data.data);

// Anonim oturum sepeti (JWT gerekmez)
export const getSessionCart = () =>
  api.get<{ data: Cart }>('/carts/session').then((r) => r.data.data);

// Sepete urun ekle (market secimi zorunlu)
export const addToCart = (productId: string, marketId: string, quantity = 1) =>
  api.post<{ data: Cart }>('/carts/items', { productId, marketId, quantity })
     .then((r) => r.data.data);

// Adet guncelle
export const updateCartItem = (itemId: string, quantity: number) =>
  api.patch<{ data: Cart }>(`/carts/items/${itemId}`, { quantity })
     .then((r) => r.data.data);

// Urun kaldir
export const removeFromCart = (itemId: string) =>
  api.delete<{ data: Cart }>(`/carts/items/${itemId}`)
     .then((r) => r.data.data);

// Sepeti bosalt
export const clearCart = () =>
  api.delete('/carts/clear').then((r) => r.data);

// Sepet optimizasyonu
export const optimizeCart = () =>
  api.get<{ data: CartOptimizationResult }>('/carts/optimize')
     .then((r) => r.data.data);

// Anonim sepeti birlesitir
export const mergeCarts = () =>
  api.post<{ data: Cart }>('/carts/merge').then((r) => r.data.data);
