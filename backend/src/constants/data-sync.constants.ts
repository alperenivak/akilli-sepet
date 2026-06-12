// =====================================================
// Veri senkronizasyonu sabitleri (backend ic kopya)
// Monorepo build ciktisinin dist/main.js olmasi icin
// dis shared paketine dogrudan import yapilmaz
// =====================================================

export const DATA_SYNC_QUEUE_NAME = 'data-sync';

export const DATA_SYNC_JOB_TYPES = {
  PRICE_UPSERT: 'PRICE_UPSERT',
  PRICE_IMPORT: 'PRICE_IMPORT',
  STALE_CHECK: 'STALE_CHECK',
  CATALOG_EXPIRE: 'CATALOG_EXPIRE',
  PRODUCT_SYNC: 'PRODUCT_SYNC',
  PRICE_SCRAPER: 'PRICE_SCRAPER',
} as const;

export const DATA_SYNC_PROVIDERS = {
  MANUAL_IMPORT: 'MANUAL_IMPORT',
  MARKET_PANEL: 'MARKET_PANEL',
  BULK_CSV: 'BULK_CSV',
  EXTERNAL_API: 'EXTERNAL_API',
  OPEN_DATA: 'OPEN_DATA',
  SCRAPER: 'SCRAPER',
} as const;

export const DATA_SYNC_LOG_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial',
  SKIPPED: 'skipped',
} as const;
