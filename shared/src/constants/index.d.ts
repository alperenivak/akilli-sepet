export declare const API_VERSION = "v1";
export declare const API_PREFIX = "/api/v1";
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
export declare const CURRENCY = "TRY";
export declare const PRICE_DIVISOR = 100;
export declare const PRODUCT_CATEGORIES: readonly [{
    readonly id: "gida";
    readonly name: "Gıda";
    readonly icon: "🛒";
}, {
    readonly id: "icecek";
    readonly name: "İçecek";
    readonly icon: "🥤";
}, {
    readonly id: "temizlik";
    readonly name: "Temizlik";
    readonly icon: "🧹";
}, {
    readonly id: "kisisel-bakim";
    readonly name: "Kişisel Bakım";
    readonly icon: "🧴";
}, {
    readonly id: "ev-yasam";
    readonly name: "Ev & Yaşam";
    readonly icon: "🏠";
}, {
    readonly id: "atistirmalik";
    readonly name: "Atıştırmalık";
    readonly icon: "🍿";
}, {
    readonly id: "sut-urunleri";
    readonly name: "Süt Ürünleri";
    readonly icon: "🥛";
}, {
    readonly id: "et-balik";
    readonly name: "Et & Balık";
    readonly icon: "🥩";
}, {
    readonly id: "meyve-sebze";
    readonly name: "Meyve & Sebze";
    readonly icon: "🥦";
}, {
    readonly id: "diger";
    readonly name: "Diğer";
    readonly icon: "📦";
}];
export declare const MARKET_COLORS: Record<string, string>;
export declare const REPORT_STATUS_LABELS: Record<string, string>;
export declare const NOTIFICATION_TITLES: Record<string, string>;
export declare const UPLOAD_LIMITS: {
    IMAGE_MAX_SIZE: number;
    CATALOG_PAGE_MAX_SIZE: number;
    ALLOWED_IMAGE_TYPES: string[];
    MAX_REPORT_IMAGES: number;
};
export declare const JWT_COOKIE_NAME = "Ak\u0131ll\u0131 Sepet_token";
export declare const JWT_REFRESH_COOKIE_NAME = "Ak\u0131ll\u0131 Sepet_refresh_token";
export declare const CACHE_TTL: {
    PRODUCT_LIST: number;
    PRODUCT_DETAIL: number;
    PRICE_LIST: number;
    MARKET_LIST: number;
    CATEGORY_LIST: number;
    AI_RECOMMENDATION: number;
};
export declare const DATA_SYNC_QUEUE_NAME = "data-sync";
export declare const DATA_SYNC_JOB_TYPES: {
    readonly PRICE_UPSERT: "PRICE_UPSERT";
    readonly PRICE_IMPORT: "PRICE_IMPORT";
    readonly STALE_CHECK: "STALE_CHECK";
    readonly CATALOG_EXPIRE: "CATALOG_EXPIRE";
    readonly PRODUCT_SYNC: "PRODUCT_SYNC";
    readonly PRICE_SCRAPER: "PRICE_SCRAPER";
};
export declare const DATA_SYNC_PROVIDERS: {
    readonly MANUAL_IMPORT: "MANUAL_IMPORT";
    readonly MARKET_PANEL: "MARKET_PANEL";
    readonly BULK_CSV: "BULK_CSV";
    readonly EXTERNAL_API: "EXTERNAL_API";
    readonly OPEN_DATA: "OPEN_DATA";
};
export declare const DATA_SYNC_LOG_STATUS: {
    readonly PENDING: "pending";
    readonly SUCCESS: "success";
    readonly FAILED: "failed";
    readonly PARTIAL: "partial";
    readonly SKIPPED: "skipped";
};
export declare const PRICE_FRESHNESS_DAYS: {
    readonly FRESH: 3;
    readonly AGING: 7;
    readonly STALE: 14;
};
export type PriceFreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unknown';
export declare const SCRAPER_QUEUE_NAME = "data-sync";
export declare const SCRAPER_DEFAULT_INTERVAL = 6;
export declare const ERROR_MESSAGES: {
    UNAUTHORIZED: string;
    FORBIDDEN: string;
    NOT_FOUND: string;
    PRODUCT_NOT_FOUND: string;
    MARKET_NOT_FOUND: string;
    USER_NOT_FOUND: string;
    INVALID_CREDENTIALS: string;
    EMAIL_ALREADY_EXISTS: string;
    BARCODE_NOT_FOUND: string;
    CART_NOT_FOUND: string;
    REPORT_NOT_FOUND: string;
    FILE_TOO_LARGE: string;
    INVALID_FILE_TYPE: string;
    SERVER_ERROR: string;
};
