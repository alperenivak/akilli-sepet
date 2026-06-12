"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_MESSAGES = exports.SCRAPER_DEFAULT_INTERVAL = exports.SCRAPER_QUEUE_NAME = exports.PRICE_FRESHNESS_DAYS = exports.DATA_SYNC_LOG_STATUS = exports.DATA_SYNC_PROVIDERS = exports.DATA_SYNC_JOB_TYPES = exports.DATA_SYNC_QUEUE_NAME = exports.CACHE_TTL = exports.JWT_REFRESH_COOKIE_NAME = exports.JWT_COOKIE_NAME = exports.UPLOAD_LIMITS = exports.NOTIFICATION_TITLES = exports.REPORT_STATUS_LABELS = exports.MARKET_COLORS = exports.PRODUCT_CATEGORIES = exports.PRICE_DIVISOR = exports.CURRENCY = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = exports.API_PREFIX = exports.API_VERSION = void 0;
exports.API_VERSION = 'v1';
exports.API_PREFIX = `/api/${exports.API_VERSION}`;
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_PAGE_SIZE = 100;
exports.CURRENCY = 'TRY';
exports.PRICE_DIVISOR = 100;
exports.PRODUCT_CATEGORIES = [
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
];
exports.MARKET_COLORS = {
    migros: '#F7892B',
    bim: '#C8102E',
    a101: '#E63329',
    sok: '#FFCC00',
    carrefour: '#003B8E',
    metro: '#EF3829',
    macro: '#6B2D8B',
};
exports.REPORT_STATUS_LABELS = {
    PENDING: 'Beklemede',
    UNDER_REVIEW: 'İnceleniyor',
    APPROVED: 'Onaylandı',
    REJECTED: 'Reddedildi',
    RESOLVED: 'Çözümlendi',
};
exports.NOTIFICATION_TITLES = {
    PRICE_DROP: 'Fiyat Düştü! 🎉',
    PRICE_ALERT: 'Fiyat Alarmı ⚡',
    REPORT_STATUS: 'İhbar Güncellendi',
    NEW_CATALOG: 'Yeni Katalog 📖',
    AI_RECOMMENDATION: 'Akıllı Öneri 🤖',
    SYSTEM: 'Sistem Bildirimi',
};
exports.UPLOAD_LIMITS = {
    IMAGE_MAX_SIZE: 5 * 1024 * 1024,
    CATALOG_PAGE_MAX_SIZE: 10 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    MAX_REPORT_IMAGES: 5,
};
exports.JWT_COOKIE_NAME = 'Akıllı Sepet_token';
exports.JWT_REFRESH_COOKIE_NAME = 'Akıllı Sepet_refresh_token';
exports.CACHE_TTL = {
    PRODUCT_LIST: 300,
    PRODUCT_DETAIL: 600,
    PRICE_LIST: 180,
    MARKET_LIST: 3600,
    CATEGORY_LIST: 86400,
    AI_RECOMMENDATION: 1800,
};
exports.DATA_SYNC_QUEUE_NAME = 'data-sync';
exports.DATA_SYNC_JOB_TYPES = {
    PRICE_UPSERT: 'PRICE_UPSERT',
    PRICE_IMPORT: 'PRICE_IMPORT',
    STALE_CHECK: 'STALE_CHECK',
    CATALOG_EXPIRE: 'CATALOG_EXPIRE',
    PRODUCT_SYNC: 'PRODUCT_SYNC',
    PRICE_SCRAPER: 'PRICE_SCRAPER',
};
exports.DATA_SYNC_PROVIDERS = {
    MANUAL_IMPORT: 'MANUAL_IMPORT',
    MARKET_PANEL: 'MARKET_PANEL',
    BULK_CSV: 'BULK_CSV',
    EXTERNAL_API: 'EXTERNAL_API',
    OPEN_DATA: 'OPEN_DATA',
};
exports.DATA_SYNC_LOG_STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    PARTIAL: 'partial',
    SKIPPED: 'skipped',
};
exports.PRICE_FRESHNESS_DAYS = {
    FRESH: 3,
    AGING: 7,
    STALE: 14,
};
exports.SCRAPER_QUEUE_NAME = exports.DATA_SYNC_QUEUE_NAME;
exports.SCRAPER_DEFAULT_INTERVAL = 6;
exports.ERROR_MESSAGES = {
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
//# sourceMappingURL=index.js.map