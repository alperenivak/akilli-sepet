// =====================================================
// Akıllı Sepet Admin Panel - API İstemcisi
// Next.js App Router ile uyumlu, JWT yönetimli
// =====================================================

import axios, { AxiosInstance } from 'axios';
import {
  User, Market, Product, Report, DashboardStats,
  PaginatedResponse, ReportStatus,
  AdminStatistics, InspectorStatistics, MarketStatistics,
} from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Request interceptor: localStorage token ekle
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: oturum süresi dolmuşsa login'e yönlendir
// NOT: /auth/login isteğinin 401'i yanlış şifre demektir — yönlendirme yapma
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginCall && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_portal');
      window.location.href = '/';
    }
    return Promise.reject(error);
  },
);

// =====================================================
// Auth
// =====================================================
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ data: { accessToken: string; user: User } }>('/auth/login', {
      email, password,
    }).then((r) => r.data.data),

  sendOtp: (email: string, purpose: 'REGISTER' | 'PASSWORD_RESET') =>
    api.post('/auth/otp/send', { email, purpose }).then((r) => r.data.data ?? r.data),

  resetPassword: (data: { email: string; verificationCode: string; newPassword: string }) =>
    api.post('/auth/reset-password', data).then((r) => r.data.data ?? r.data),
};

// =====================================================
// Dashboard
// =====================================================
export const adminApi = {
  getDashboard: () =>
    api.get('/admin/dashboard').then((r) => {
      // Backend iç içe yapısını düz DashboardStats'a dönüştür
      const d = r.data.data;
      return {
        totalUsers:       d.users?.total       ?? d.totalUsers       ?? 0,
        totalProducts:    d.products?.total    ?? d.totalProducts    ?? 0,
        totalMarkets:     d.markets?.total     ?? d.totalMarkets     ?? 0,
        totalPrices:      d.prices?.total      ?? d.totalPrices      ?? 0,
        totalReports:     d.reports?.total     ?? d.totalReports     ?? 0,
        pendingReports:   d.reports?.pending   ?? d.pendingReports   ?? 0,
        activeCatalogs:   d.catalogs?.active   ?? d.activeCatalogs   ?? 0,
        priceUpdatesToday: d.prices?.updatesLast24h ?? d.priceUpdatesToday ?? 0,
      } as DashboardStats;
    }),

  getDataQuality: () =>
    api.get('/admin/data-quality').then((r) => r.data.data ?? r.data),

  getAuditLogs: (page = 1, limit = 20) =>
    api.get('/admin/audit-logs', { params: { page, limit } }).then((r) => r.data.data),

  getScraperLogs: (page = 1) =>
    api.get('/admin/scraper-logs', { params: { page } }).then((r) => r.data.data),

  seedDemo: () =>
    api.post('/scraper/seed-demo').then((r) => r.data),
};

// =====================================================
// İstatistikler (rol bazlı)
// =====================================================
export const statisticsApi = {
  getAdmin: () =>
    api.get<{ data: AdminStatistics }>('/statistics/admin').then((r) => r.data.data),

  getInspector: () =>
    api.get<{ data: InspectorStatistics }>('/statistics/inspector').then((r) => r.data.data),

  getMarket: () =>
    api.get<{ data: MarketStatistics }>('/statistics/market').then((r) => r.data.data),
};

// =====================================================
// Kullanicilar
// =====================================================
export const usersApi = {
  getStats: () =>
    api.get<{ data: { total: number; active: number; inactive: number; roles: Record<string, number> } }>('/users/stats')
      .then((r) => r.data.data),

  getAll: (params: { search?: string; role?: string; page?: number; limit?: number } = {}) =>
    api.get<{ data: PaginatedResponse<User> }>('/users', { params }).then((r) => r.data.data),

  toggleActive: (id: string) =>
    api.patch<{ data: User }>(`/users/${id}/toggle-active`).then((r) => r.data.data),

  changeRole: (id: string, role: string) =>
    api.patch<{ data: User }>(`/users/${id}/role`, { role }).then((r) => r.data.data),

  banUser: (
    id: string,
    payload: { durationMinutes?: number; reason: string; isPermanent?: boolean },
  ) =>
    api.patch<{ data: User }>(`/users/${id}/ban`, payload).then((r) => r.data.data),

  unbanUser: (id: string) =>
    api.patch<{ data: User }>(`/users/${id}/unban`).then((r) => r.data.data),
};

// =====================================================
// Urunler
// =====================================================
export type ProductSortBy = 'name' | 'brand' | 'category' | 'createdAt' | 'expiryDate';
export type SortOrder = 'asc' | 'desc';

export const productsApi = {
  getStats: () =>
    api.get<{ data: { total: number; active: number; inactive: number; sktNearby30: number } }>('/products/stats')
      .then((r) => r.data.data),

  getAll: (params: {
    search?: string;
    categoryId?: string;
    brand?: string;
    marketId?: string;
    isActive?: boolean;
    sortBy?: ProductSortBy;
    sortOrder?: SortOrder;
    page?: number;
    limit?: number;
  } = {}) =>
    api.get<{ data: PaginatedResponse<Product> }>('/products', { params }).then((r) => r.data.data),

  create: (data: {
    name: string; brand?: string; categoryId: string;
    unit?: string; unitValue?: number; description?: string; barcodes?: string[];
  }) => api.post<{ data: Product }>('/products', data).then((r) => r.data.data),

  update: (id: string, data: Partial<Product>) =>
    api.patch<{ data: Product }>(`/products/${id}`, data).then((r) => r.data.data),

  getOne: (id: string) =>
    api.get<{ data: ProductDetail }>(`/products/${id}`).then((r) => r.data.data),

  addBarcode: (productId: string, code: string) =>
    api.post(`/products/${productId}/barcodes`, { code }).then((r) => r.data.data),

  getCategories: () =>
    api.get('/products/categories').then((r) => r.data.data),

  getCategorySuggestions: () =>
    api.get<{ data: {
      total: number;
      mismatchCount: number;
      suggestions: Array<{
        productId: string;
        productName: string;
        brand: string | null;
        currentCategoryId: string;
        currentCategoryName: string;
        suggestedCategoryId: string;
        suggestedCategoryName: string;
      }>;
    } }>('/products/category-suggestions').then((r) => r.data.data),

  applyCategories: (fixes: Array<{ productId: string; categoryId: string }>) =>
    api.post<{ data: { updated: number } }>('/products/apply-categories', { fixes })
      .then((r) => r.data.data),
};

export const pricesByProductApi = {
  getForProduct: (productId: string) =>
    api.get<{ data: { product: Product; prices: ProductMarketPrice[] } }>(`/prices/product/${productId}`)
      .then((r) => r.data.data),
};

export interface ProductMarketPrice {
  id: string;
  amount: number;
  isAvailable: boolean;
  lastUpdated: string;
  source: string;
  market: {
    id: string;
    name: string;
    logoUrl?: string;
    brandColor?: string;
    slug?: string;
  };
}

export interface ProductDetail extends Product {
  description?: string;
  origin?: string;
  imageUrl?: string;
  barcodes: Array<{ id: string; code: string; format: string }>;
  nearestExpiryDate?: string;
  prices?: ProductMarketPrice[];
  reports?: Array<{
    id: string;
    status: string;
    expiryDate?: string;
    city?: string;
    createdAt: string;
    market?: { name: string };
  }>;
}

// =====================================================
// Marketler
// =====================================================
export const marketsApi = {
  getAll: () =>
    api.get<{ data: Market[] }>('/markets').then((r) => r.data.data),

  getOne: (id: string) =>
    api.get<{ data: Market }>(`/markets/${id}`).then((r) => r.data.data),

  create: (data: { name: string; slug?: string; brandColor?: string; website?: string }) =>
    api.post<{ data: Market }>('/markets', data).then((r) => r.data.data),

  update: (id: string, data: Partial<Market>) =>
    api.patch<{ data: Market }>(`/markets/${id}`, data).then((r) => r.data.data),

  createBranch: (marketId: string, data: {
    name: string; address: string; city: string; district?: string;
    latitude: number; longitude: number; phone?: string; workingHours?: string;
  }) => api.post(`/markets/${marketId}/branches`, data).then((r) => r.data.data),

  updateBranch: (branchId: string, data: {
    name?: string; address?: string; city?: string; district?: string;
    latitude?: number; longitude?: number; phone?: string; workingHours?: string; isActive?: boolean;
  }) => api.patch(`/markets/branches/${branchId}`, data).then((r) => r.data.data),

  getBranches: (marketId: string, includeInactive = false) =>
    api.get(`/markets/${marketId}/branches`, {
      params: includeInactive ? { includeInactive: true } : undefined,
    }).then((r) => r.data.data),
};

// =====================================================
// Fiyatlar
// =====================================================
export const pricesApi = {
  upsert: (data: { productId: string; marketId: string; amount: number; source?: string }) =>
    api.post('/prices', data).then((r) => r.data.data),

  bulkUpsert: (prices: Array<{ productId: string; marketId: string; amount: number }>) =>
    api.post('/prices/bulk', { prices }).then((r) => r.data.data),

  getHistory: (productId: string, marketId: string) =>
    api.get<{ data: { price: { amount: number; lastUpdated: string; source?: string }; history: Array<{ amount: number; recordedAt: string }> } }>(
      `/prices/product/${productId}/market/${marketId}/history`,
    ).then((r) => r.data.data),
};

// =====================================================
// Ihbarlar
// =====================================================
export const reportsApi = {
  getAll: (params: {
    status?: ReportStatus;
    page?: number;
    limit?: number;
    marketId?: string;
    pushedToMarket?: boolean;
  } = {}) =>
    api.get<{ data: PaginatedResponse<Report> }>('/reports', { params }).then((r) => r.data.data),

  getOne: (id: string) =>
    api.get<{ data: Report }>(`/reports/${id}`).then((r) => r.data.data),

  getStats: () =>
    api.get('/reports/stats').then((r) => r.data.data),

  updateStatus: (id: string, status: ReportStatus, userNote?: string) =>
    api.patch(`/reports/${id}/status`, { status, userNote }).then((r) => r.data.data),

  pushToMarket: (
    id: string,
    data: { marketId: string; branchId?: string; marketNote?: string },
  ) =>
    api.patch<{ data: Report }>(`/reports/${id}/push-to-market`, data).then((r) => r.data.data),
};

// =====================================================
// Kataloglar
// =====================================================
export const catalogsApi = {
  getActive: () =>
    api.get('/catalogs').then((r) => r.data.data),

  getManagerList: (marketId?: string) =>
    api.get('/catalogs/manager/list', { params: marketId ? { marketId } : undefined })
      .then((r) => r.data.data),

  getAll: (params: { page?: number; limit?: number; marketId?: string } = {}) =>
    api.get('/catalogs/admin/all', { params }).then((r) => r.data.data),

  getOne: (id: string) =>
    api.get(`/catalogs/${id}`).then((r) => r.data.data),

  create: (data: {
    marketId: string; title: string;
    startDate: string; endDate: string; coverImageUrl?: string; pdfUrl?: string;
    description?: string;
  }) => api.post('/catalogs', data).then((r) => r.data.data),

  update: (id: string, data: Partial<{
    title: string; description: string; coverImageUrl: string;
    pdfUrl: string; startDate: string; endDate: string; isActive: boolean;
  }>) => api.put(`/catalogs/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    api.delete(`/catalogs/${id}`).then((r) => r.data.data),

  toggleActive: (id: string) =>
    api.patch(`/catalogs/${id}/toggle-active`).then((r) => r.data.data),

  setCoverFromFirstPage: (id: string) =>
    api.patch(`/catalogs/${id}/cover-from-first-page`).then((r) => r.data.data),

  addPage: (catalogId: string, data: {
    pageNumber: number; imageUrl: string; thumbnailUrl?: string;
  }) => api.post(`/catalogs/${catalogId}/pages`, data).then((r) => r.data.data),

  bulkAddPages: (catalogId: string, imageUrls: string[]) =>
    api.post(`/catalogs/${catalogId}/pages/bulk`, { imageUrls }).then((r) => r.data.data),

  uploadImage: (catalogId: string, file: File, type: 'cover' | 'page') => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post(`/catalogs/${catalogId}/upload-image?type=${type}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.data);
  },

  removePage: (catalogId: string, pageId: string) =>
    api.delete(`/catalogs/${catalogId}/pages/${pageId}`).then((r) => r.data.data),

  scrapeAll: () =>
    api.post('/catalogs/admin/scrape-all').then((r) => r.data.data),

  scrapeMarket: (slug: string) =>
    api.post(`/catalogs/admin/scrape/${slug}`).then((r) => r.data.data),

  scrapeOwnMarket: () =>
    api.post('/catalogs/manager/scrape').then((r) => r.data.data),
};

// =====================================================
// Market Paneli (Market Yöneticisi Görünümü)
// =====================================================
export const marketPanelApi = {
  getMarket: (marketId: string) =>
    api.get(`/markets/${marketId}`).then((r) => r.data.data),

  getReports: (
    marketId: string,
    params: { status?: string; page?: number; limit?: number; pushedToMarket?: boolean } = {},
  ) =>
    api.get<{ data: PaginatedResponse<Report> }>('/reports', {
      params: { ...params, marketId, pushedToMarket: true },
    }).then((r) => r.data.data),

  getCatalogs: (marketId: string) =>
    catalogsApi.getManagerList(marketId),

  getBranches: (marketId: string, includeInactive = false) =>
    marketsApi.getBranches(marketId, includeInactive),

  getPrices: (marketId: string, params: { search?: string; page?: number } = {}) =>
    api.get('/prices', { params: { ...params, marketId } }).then((r) => r.data.data),

  updateReportStatus: (id: string, status: ReportStatus, userNote?: string) =>
    api.patch(`/reports/${id}/status`, { status, userNote }).then((r) => r.data.data),
};

// =====================================================
// Veri Senkronizasyonu
// =====================================================
export const dataSyncApi = {
  getStatus: () =>
    api.get('/data-sync/status').then((r) => r.data.data ?? r.data),

  getLogs: (page = 1, limit = 20) =>
    api.get('/data-sync/logs', { params: { page, limit } }).then((r) => r.data.data ?? r.data),

  importPricesByBarcode: (items: Array<{ barcode: string; marketSlug: string; amount: number }>) =>
    api.post('/data-sync/import/prices-by-barcode', { items }).then((r) => r.data.data ?? r.data),

  runStaleCheck: () =>
    api.post('/data-sync/maintenance/stale-check').then((r) => r.data.data ?? r.data),

  runCatalogExpire: () =>
    api.post('/data-sync/maintenance/catalog-expire').then((r) => r.data.data ?? r.data),
};

// =====================================================
// Crowdsource Fiyat Bildirimleri
// =====================================================
export type RewardCodeMode = 'MANUAL' | 'AUTO' | 'HYBRID';

export interface RewardFormData {
  slug: string;
  title: string;
  description: string;
  benefitText: string;
  discountLabel: string;
  minReputation: number;
  levelLabel: string;
  levelIcon: string;
  instructions?: string;
  marketId?: string;
  codeMode?: RewardCodeMode;
  codePrefix?: string;
  autoExpiresDays?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export const rewardsApi = {
  listAdmin: () =>
    api.get('/rewards/admin').then((r) => r.data.data ?? r.data),

  createAdmin: (data: RewardFormData) =>
    api.post('/rewards/admin', data).then((r) => r.data.data ?? r.data),

  updateAdmin: (rewardId: string, data: Partial<RewardFormData>) =>
    api.patch(`/rewards/admin/${rewardId}`, data).then((r) => r.data.data ?? r.data),

  addCodes: (rewardId: string, codes: string[], expiresAt?: string) =>
    api.post(`/rewards/admin/${rewardId}/codes`, { codes, expiresAt })
      .then((r) => r.data.data ?? r.data),

  listClaims: (rewardId: string) =>
    api.get(`/rewards/admin/${rewardId}/claims`).then((r) => r.data.data ?? r.data),

  listMarket: () =>
    api.get('/rewards/market').then((r) => r.data.data ?? r.data),

  createMarket: (data: RewardFormData) =>
    api.post('/rewards/market', data).then((r) => r.data.data ?? r.data),

  updateMarket: (rewardId: string, data: Partial<RewardFormData>) =>
    api.patch(`/rewards/market/${rewardId}`, data).then((r) => r.data.data ?? r.data),

  addCodesMarket: (rewardId: string, codes: string[], expiresAt?: string) =>
    api.post(`/rewards/market/${rewardId}/codes`, { codes, expiresAt })
      .then((r) => r.data.data ?? r.data),

  listClaimsMarket: (rewardId: string) =>
    api.get(`/rewards/market/${rewardId}/claims`).then((r) => r.data.data ?? r.data),
};

export const submissionsApi = {
  list: (params: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    page?: number;
    limit?: number;
    isAbnormal?: boolean;
    needsReview?: boolean;
  } = {}) =>
    api.get('/prices/submissions', { params }).then((r) => r.data.data ?? r.data),

  review: (id: string, decision: 'APPROVED' | 'REJECTED', adminNote?: string) =>
    api.patch(`/prices/submissions/${id}/review`, { decision, adminNote })
      .then((r) => r.data.data ?? r.data),
};

export const contributionsApi = {
  list: (params: {
    type?: 'BARCODE' | 'MARKET_LISTING';
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    page?: number;
    limit?: number;
  } = {}) =>
    api.get('/contributions', { params }).then((r) => r.data.data ?? r.data),

  review: (id: string, decision: 'APPROVED' | 'REJECTED', adminNote?: string) =>
    api.patch(`/contributions/${id}/review`, { decision, adminNote })
      .then((r) => r.data.data ?? r.data),
};

export default api;
