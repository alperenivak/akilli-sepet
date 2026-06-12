// =====================================================
// Akıllı Sepet - Paylasilan Sabitler
// Tum bilesenler tarafindan kullanilan sabit degerler
// =====================================================

// --- API Sabitleri ---
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// --- Sayfalama Varsayilanlari ---
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// --- Fiyat Sabitleri ---
export const CURRENCY = 'TRY';
// Fiyatlar kurus cinsinden saklanir, gosterimde 100'e bolunur
export const PRICE_DIVISOR = 100;

// --- Urun Kategorileri ---
export const PRODUCT_CATEGORIES = [
  { id: 'gida', name: 'Gıda', icon: '🛒' },
  { id: 'icecek', name: 'İçecek', icon: '🥤' },
  { id: 'temizlik', name: 'Temizlik', icon: '🧹' },
  { id: 'kisisel-bakim', name: 'Kişisel Bakım', icon: '🧴' },
  { id: 'ev-yasam', name: 'Ev & Yaşam', icon: '🏠' },
  { id: 'atistirmalik', name: 'Atıştırmalık', icon: '🍿' },
  { id: 'sut-urunleri', name: 'Süt Ürünleri', icon: '🥛' },
  { id: 'et-balik', name: 'Et & Balık', icon: '🥩' },
  { id: 'meyve-sebze', name: 'Meyve & Sebze', icon: '🥦' },
  { id: 'diger', name: 'Diğer', icon: '📦' },
] as const;

// --- Market Renkleri (Marka Kimligi) ---
export const MARKET_COLORS: Record<string, string> = {
  migros: '#F7892B',
  bim: '#C8102E',
  a101: '#E63329',
  sok: '#FFCC00',
  carrefour: '#003B8E',
  metro: '#EF3829',
  macro: '#6B2D8B',
};

// --- Ihbar Durum Etiketleri ---
export const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Beklemede',
  UNDER_REVIEW: 'İnceleniyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  RESOLVED: 'Çözümlendi',
};

// --- Bildirim Basliklari ---
export const NOTIFICATION_TITLES: Record<string, string> = {
  PRICE_DROP: 'Fiyat Düştü! 🎉',
  PRICE_ALERT: 'Fiyat Alarmı ⚡',
  REPORT_STATUS: 'İhbar Güncellendi',
  NEW_CATALOG: 'Yeni Katalog 📖',
  AI_RECOMMENDATION: 'Akıllı Öneri 🤖',
  SYSTEM: 'Sistem Bildirimi',
};

// --- Dosya Yukleme Limitleri ---
export const UPLOAD_LIMITS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5 MB
  CATALOG_PAGE_MAX_SIZE: 10 * 1024 * 1024, // 10 MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_REPORT_IMAGES: 5,
};

// --- JWT Sabitleri ---
export const JWT_COOKIE_NAME = 'Akıllı Sepet_token';
export const JWT_REFRESH_COOKIE_NAME = 'Akıllı Sepet_refresh_token';

// --- Cache Sureleri (saniye) ---
export const CACHE_TTL = {
  PRODUCT_LIST: 300,         // 5 dakika
  PRODUCT_DETAIL: 600,       // 10 dakika
  PRICE_LIST: 180,           // 3 dakika
  MARKET_LIST: 3600,         // 1 saat
  CATEGORY_LIST: 86400,      // 1 gun
  AI_RECOMMENDATION: 1800,   // 30 dakika
};

// --- Veri Senkronizasyonu (Data Sync) ---
export const DATA_SYNC_QUEUE_NAME = 'data-sync';

/** Kuyruk is tipleri — dis kaynak baglantisi olmadan ic islemler */
export const DATA_SYNC_JOB_TYPES = {
  PRICE_UPSERT: 'PRICE_UPSERT',
  PRICE_IMPORT: 'PRICE_IMPORT',
  STALE_CHECK: 'STALE_CHECK',
  CATALOG_EXPIRE: 'CATALOG_EXPIRE',
  PRODUCT_SYNC: 'PRODUCT_SYNC',
  PRICE_SCRAPER: 'PRICE_SCRAPER',
} as const;

/** Gelecekte baglanacak veri saglayicilari (simdi yalnizca ic kaynaklar aktif) */
export const DATA_SYNC_PROVIDERS = {
  MANUAL_IMPORT: 'MANUAL_IMPORT',
  MARKET_PANEL: 'MARKET_PANEL',
  BULK_CSV: 'BULK_CSV',
  EXTERNAL_API: 'EXTERNAL_API',
  OPEN_DATA: 'OPEN_DATA',
} as const;

export const DATA_SYNC_LOG_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial',
  SKIPPED: 'skipped',
} as const;

/** Fiyat tazelik esikleri (gun) */
export const PRICE_FRESHNESS_DAYS = {
  FRESH: 3,
  AGING: 7,
  STALE: 14,
} as const;

export type PriceFreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unknown';

/** @deprecated SCRAPER_QUEUE_NAME yerine DATA_SYNC_QUEUE_NAME kullanin */
export const SCRAPER_QUEUE_NAME = DATA_SYNC_QUEUE_NAME;
export const SCRAPER_DEFAULT_INTERVAL = 6;

// --- Hata Mesajlari ---
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Bu işlem için giriş yapmanız gerekiyor.',
  FORBIDDEN: 'Bu işlem için yetkiniz bulunmuyor.',
  NOT_FOUND: 'İstenen kaynak bulunamadı.',
  PRODUCT_NOT_FOUND: 'Ürün bulunamadı.',
  MARKET_NOT_FOUND: 'Market bulunamadı.',
  USER_NOT_FOUND: 'Kullanıcı bulunamadı.',
  INVALID_CREDENTIALS: 'E-posta veya şifre hatalı.',
  EMAIL_ALREADY_EXISTS: 'Bu e-posta adresi zaten kullanılıyor.',
  BARCODE_NOT_FOUND: 'Bu barkoda ait ürün sistemde kayıtlı değil.',
  CART_NOT_FOUND: 'Sepet bulunamadı.',
  REPORT_NOT_FOUND: 'İhbar bulunamadı.',
  FILE_TOO_LARGE: 'Dosya boyutu çok büyük.',
  INVALID_FILE_TYPE: 'Desteklenmeyen dosya türü.',
  SERVER_ERROR: 'Bir hata oluştu. Lütfen tekrar deneyin.',
};
