// =====================================================
// Veri Senkronizasyonu Yapilandirmasi
// Dis kaynak cekimi varsayilan olarak KAPALI
// =====================================================

import { registerAs } from '@nestjs/config';

export const dataSyncConfig = registerAs('dataSync', () => ({
  /** Otomatik bakim cron'lari (eski fiyat isaretleme, katalog pasif) */
  cronEnabled: process.env.DATA_SYNC_CRON_ENABLED !== 'false',

  /** Harici API / acik veri saglayicilari — varsayilan KAPALI */
  externalProvidersEnabled: process.env.DATA_SYNC_EXTERNAL_PROVIDERS_ENABLED === 'true',

  /** Fiyat kac gunden eskiyse needsVerification=true */
  priceStaleDays: parseInt(process.env.DATA_SYNC_PRICE_STALE_DAYS || '7', 10),

  /** Tazelik: fresh (gun) */
  priceFreshDays: parseInt(process.env.DATA_SYNC_PRICE_FRESH_DAYS || '3', 10),

  /** Demo seed API uzerinden calistirilabilir mi (production'da false) */
  allowDemoSeed: process.env.ALLOW_DEMO_SEED === 'true',
}));
