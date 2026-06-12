// =====================================================
// Akıllı Sepet - Paylasilan Tip Tanimlari
// Tum bilesenler tarafindan kullanilan ortak tipler
// =====================================================

// --- Kullanici Rolleri ---
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',  // Tam yetkili sistem yoneticisi
  ADMIN = 'ADMIN',               // Genel yonetici
  INSPECTOR = 'INSPECTOR',       // Kurum denetcisi
  MARKET_MANAGER = 'MARKET_MANAGER', // Market yoneticisi
  USER = 'USER',                 // Normal kullanici
}

// --- Kullanici Tipleri ---
export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- Urun Tipleri ---
export interface Product {
  id: string;
  name: string;
  brand: string;
  description?: string;
  imageUrl?: string;
  categoryId: string;
  category?: Category;
  barcodes?: Barcode[];
  prices?: Price[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Barcode {
  id: string;
  code: string;
  format: BarcodeFormat;
  productId: string;
}

export enum BarcodeFormat {
  EAN_13 = 'EAN_13',
  EAN_8 = 'EAN_8',
  UPC_A = 'UPC_A',
  QR_CODE = 'QR_CODE',
  CODE_128 = 'CODE_128',
  CODE_39 = 'CODE_39',
  UNKNOWN = 'UNKNOWN',
}

// --- Kategori Tipleri ---
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parentId?: string;
  children?: Category[];
}

// --- Market Tipleri ---
export interface Market {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  brandColor?: string;
  website?: string;
  branches?: MarketBranch[];
  isActive: boolean;
  createdAt: Date;
}

export interface MarketBranch {
  id: string;
  marketId: string;
  name: string;
  address: string;
  city: string;
  district: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  workingHours?: string;
}

// --- Fiyat Tipleri ---
export interface Price {
  id: string;
  productId: string;
  marketId: string;
  market?: Market;
  amount: number;          // Kurus cinsinden (ornegin 2999 = 29.99 TL)
  discountedAmount?: number; // Indirimli fiyat (kurus)
  currency: string;        // Varsayilan: TRY
  unit?: string;           // kg, litre, adet, vs.
  isAvailable: boolean;
  source?: PriceSource;
  needsVerification?: boolean;
  freshness?: 'fresh' | 'aging' | 'stale' | 'unknown';
  lastUpdated: Date;
  priceHistory?: PriceHistory[];
}

export interface PriceHistory {
  id: string;
  priceId: string;
  amount: number;          // Kurus cinsinden
  recordedAt: Date;
  source: PriceSource;
}

export enum PriceSource {
  SCRAPER = 'SCRAPER',         // Otomatik veri cekme
  MANUAL_ADMIN = 'MANUAL_ADMIN', // Admin manuel girisi
  MARKET_PANEL = 'MARKET_PANEL', // Market yoneticisi girisi
  CROWDSOURCE = 'CROWDSOURCE', // Kullanici bildirimi
  API = 'API',                 // Harici API
}

// --- Sepet Tipleri ---
export interface Cart {
  id: string;
  userId?: string;
  sessionId?: string;   // Giris yapmamis kullaniciler icin
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  product?: Product;
  quantity: number;
  addedAt: Date;
}

// --- Sepet Optimizasyon Sonucu ---
export interface CartOptimizationResult {
  marketId: string;
  market: Market;
  totalAmount: number;     // Toplam tutar (kurus)
  itemsFound: number;      // Bulunan urun sayisi
  itemsMissing: number;    // Bulunamayan urun sayisi
  missingProducts?: Product[];
  savings?: number;        // Diger marketlere gore tasarruf (kurus)
  rank: number;            // Siralama (1 = en ucuz)
}

// --- Ihbar (Tarihi Gecmis Urun) Tipleri ---
export interface Report {
  id: string;
  userId?: string;
  user?: User;
  productId?: string;
  product?: Product;
  barcodeCode?: string;
  marketId?: string;
  market?: Market;
  branchId?: string;
  branch?: MarketBranch;
  description: string;
  status: ReportStatus;
  location?: ReportLocation;
  images?: ReportImage[];
  userNote?: string;
  marketNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ReportStatus {
  PENDING = 'PENDING',       // Beklemede
  UNDER_REVIEW = 'UNDER_REVIEW', // Inceleniyor
  APPROVED = 'APPROVED',     // Onaylandi
  REJECTED = 'REJECTED',     // Reddedildi
  RESOLVED = 'RESOLVED',     // Cozumlendi
}

export interface ReportLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  district?: string;
}

export interface ReportImage {
  id: string;
  reportId: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

// --- Katalog Tipleri ---
export interface Catalog {
  id: string;
  marketId: string;
  market?: Market;
  title: string;
  coverImageUrl?: string;
  startDate: Date;
  endDate: Date;
  pageCount: number;
  pages?: CatalogPage[];
  isActive: boolean;
  createdAt: Date;
}

export interface CatalogPage {
  id: string;
  catalogId: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl?: string;
}

// --- Bildirim Tipleri ---
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

export enum NotificationType {
  PRICE_DROP = 'PRICE_DROP',           // Fiyat dustu
  PRICE_ALERT = 'PRICE_ALERT',         // Fiyat alarmi
  REPORT_STATUS = 'REPORT_STATUS',     // Ihbar durum guncelleme
  NEW_CATALOG = 'NEW_CATALOG',         // Yeni katalog
  AI_RECOMMENDATION = 'AI_RECOMMENDATION', // AI onerisi
  SYSTEM = 'SYSTEM',                   // Sistem bildirimi
}

// --- AI Tipleri ---
export interface AIRecommendation {
  id: string;
  userId?: string;
  type: AIRecommendationType;
  title: string;
  description: string;
  products?: Product[];
  markets?: Market[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  createdAt: Date;
}

export enum AIRecommendationType {
  PRICE_TREND = 'PRICE_TREND',         // Fiyat trendi tahmini
  SIMILAR_PRODUCTS = 'SIMILAR_PRODUCTS', // Benzer urunler
  BEST_MARKET = 'BEST_MARKET',         // En iyi market onerisi
  SEASONAL_DEAL = 'SEASONAL_DEAL',     // Mevsimsel firsat
  PERSONALIZED = 'PERSONALIZED',       // Kisisellestirilmis oneri
}

// --- API Yanit Tipleri ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// --- Kimlik Dogrulama Tipleri ---
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  surname: string;
  phone?: string;
}

export interface JwtPayload {
  sub: string;         // Kullanici ID
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
