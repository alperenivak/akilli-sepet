// =====================================================
// Akıllı Sepet - Auth State Yonetimi (Zustand)
// Login, register, logout, token yonetimi
// =====================================================

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User, AuthResponse } from '../types/api';
import { STORAGE_KEYS } from '../api/client';
import { login as apiLogin, register as apiRegister, logout as apiLogout, getMe } from '../api/auth';
import { mergeCarts } from '../api/cart';
import { useCartStore } from './cartStore';
import {
  BanInfo,
  buildBanInfoFromError,
  buildBanInfoFromUser,
  isBanActive,
} from '../utils/ban';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  banInfo: BanInfo | null;

  loadUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    surname: string;
    phone?: string;
    verificationCode: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setBanInfo: (info: BanInfo | null) => void;
  clearBanIfExpired: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  banInfo: null,

  loadUser: async () => {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await getMe();
      const banInfo = buildBanInfoFromUser(user);
      set({
        user,
        isAuthenticated: true,
        banInfo,
      });
    } catch (error: any) {
      const banInfo = buildBanInfoFromError(error?.response?.data);
      if (banInfo) {
        set({ banInfo, isAuthenticated: true });
        return;
      }
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      set({ user: null, isAuthenticated: false, banInfo: null });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const result: AuthResponse = await apiLogin({ email, password });

      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, result.refreshToken),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, result.user.id),
      ]);

      const banInfo = buildBanInfoFromUser(result.user);
      set({ user: result.user, isAuthenticated: true, banInfo });

      if (!banInfo) {
        try {
          await mergeCarts();
          await useCartStore.getState().fetchCart();
        } catch { /* Sessizce yoksay */ }
      }
    } catch (error: any) {
      const data = error?.response?.data;
      const message =
        (Array.isArray(data?.errors) && data.errors.length > 0)
          ? data.errors.join('\n')
          : (data?.message ?? 'Giriş başarısız, bilgilerinizi kontrol edin');
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const result: AuthResponse = await apiRegister(data);

      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, result.accessToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, result.refreshToken),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, result.user.id),
      ]);

      set({ user: result.user, isAuthenticated: true, banInfo: null });

      try {
        await mergeCarts();
        await useCartStore.getState().fetchCart();
      } catch { /* Sessizce yoksay */ }
    } catch (error: any) {
      const data = error?.response?.data;
      const message =
        (Array.isArray(data?.errors) && data.errors.length > 0)
          ? data.errors.join('\n')
          : (Array.isArray(data?.message) ? data.message.join('\n') : (data?.message ?? 'Kayıt başarısız'));
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try { await apiLogout(); } catch { /* Hata olsa da cikis yap */ }
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
    ]);
    set({ user: null, isAuthenticated: false, error: null, banInfo: null });
  },

  clearError: () => set({ error: null }),
  setBanInfo: (info) => set({ banInfo: info }),
  clearBanIfExpired: () => {
    const { banInfo } = get();
    if (!isBanActive(banInfo)) {
      set({ banInfo: null });
    }
  },
}));
