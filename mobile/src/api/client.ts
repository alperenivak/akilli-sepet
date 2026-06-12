// =====================================================
// Akıllı Sepet - Axios API İstemcisi
// JWT yenileme, session ID yonetimi
// =====================================================

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../utils/constants';

import { BanInfo, buildBanInfoFromError } from '../utils/ban';

let _setBanInfo: ((info: BanInfo | null) => void) | null = null;
export function registerBanHandler(fn: typeof _setBanInfo) {
  _setBanInfo = fn;
}

// Oturum anahtarlari
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  SESSION_ID: 'session_id',
  USER_ID: 'user_id',
} as const;

// Anonim kullanici icin oturum ID uret/getir
export async function getOrCreateSessionId(): Promise<string> {
  let sid = await SecureStore.getItemAsync(STORAGE_KEYS.SESSION_ID);
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_ID, sid);
  }
  return sid;
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: __DEV__ ? 8000 : 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Request interceptor: token ve session ekleme ----
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const [token, sessionId] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
    getOrCreateSessionId(),
  ]);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['x-session-id'] = sessionId;

  return config;
});

// ---- Response interceptor: 401 → token yenile, 403 → ban kontrol ----
let isRefreshing = false;
let waitQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // 403 USER_BANNED kontrolü
    if (error.response?.status === 403 && error.response?.data?.error === 'USER_BANNED') {
      const banInfo = buildBanInfoFromError(error.response.data);
      if (banInfo) _setBanInfo?.(banInfo);
      return Promise.reject(error);
    }

    // Ag hatasi (sunucuya ulasilamadi) — token yenileme deneme
    if (!error.response) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        // Diger istekler token yenilenene kadar beklesin
        return new Promise((resolve) => {
          waitQueue.push((newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;

      try {
        const [refreshToken, userId] = await Promise.all([
          SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
          SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
        ]);
        if (!refreshToken || !userId) throw new Error('Token bilgileri eksik');

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          userId,
          refreshToken,
        });

        const newToken: string = data.data?.accessToken;
        await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, newToken);

        // Bekleyen istekleri tetikle
        waitQueue.forEach((cb) => cb(newToken));
        waitQueue = [];

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Token yenileme basarisiz: temizle
        await Promise.all([
          SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
          SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
          SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
        ]);
        waitQueue = [];
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
