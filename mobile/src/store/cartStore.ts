// =====================================================
// Akıllı Sepet - Sepet State Yonetimi (Zustand)
// =====================================================

import { create } from 'zustand';
import { Cart, CartOptimizationResult } from '../types/api';
import * as SecureStore from 'expo-secure-store';
import {
  getCart, getSessionCart, addToCart, updateCartItem,
  removeFromCart, clearCart, optimizeCart,
} from '../api/cart';
import { STORAGE_KEYS } from '../api/client';

function apiMsg(err: unknown, fallback: string): string {
  return (err as any)?.response?.data?.message ?? fallback;
}

/** Zustand selector'larında ?? [] yerine — her render'da yeni referans sonsuz döngüye yol açar */
export const EMPTY_CART_ITEMS: Cart['items'] = [];

interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;

  fetchCart: () => Promise<void>;
  addItem: (productId: string, marketId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  optimize: () => Promise<CartOptimizationResult>;
  getTotalItems: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  isLoading: false,
  error: null,

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      const cart = token ? await getCart() : await getSessionCart();
      set({ cart });
    } catch {
      // Baglanti yoksa veya bos sepet — sessizce devam
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (productId: string, marketId: string, quantity = 1) => {
    set({ isLoading: true });
    try {
      const cart = await addToCart(productId, marketId, quantity);
      set({ cart });
    } catch (error: unknown) {
      set({ error: apiMsg(error, 'Sepete eklenemedi') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateItem: async (itemId: string, quantity: number) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await updateCartItem(itemId, quantity);
      set({ cart });
    } catch (error: unknown) {
      set({ error: apiMsg(error, 'Miktar güncellenemedi') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeItem: async (itemId: string) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await removeFromCart(itemId);
      set({ cart });
    } catch (error: unknown) {
      set({ error: apiMsg(error, 'Ürün kaldırılamadı') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clear: async () => {
    set({ isLoading: true, error: null });
    try {
      await clearCart();
      set({ cart: null });
    } catch (error: unknown) {
      set({ error: apiMsg(error, 'Sepet temizlenemedi') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  optimize: async (): Promise<CartOptimizationResult> => {
    const result = await optimizeCart();
    return result;
  },

  getTotalItems: () => get().cart?.totalItems ?? 0,
}));
