// =====================================================
// Fiyat Scraper Yapilandirmasi
// =====================================================

import { registerAs } from '@nestjs/config';

export const scraperConfig = registerAs('scraper', () => ({
  /** Scraper cron ve manuel tetikleme */
  enabled: process.env.PRICE_SCRAPER_ENABLED === 'true',

  /** Backend acilisinda bir kez canli veri cek */
  syncOnStartup: process.env.PRICE_SCRAPER_SYNC_ON_STARTUP === 'true',
  startupDelayMs: parseInt(process.env.PRICE_SCRAPER_STARTUP_DELAY_MS || '15000', 10),

  /** Demo seed urunlerini SCRAPER verisi gelince gizle */
  deactivateDemoProducts: process.env.PRICE_SCRAPER_DEACTIVATE_DEMO === 'true',

  cronExpression: process.env.PRICE_SCRAPER_CRON || '0 3 * * *',

  minDelayMs: parseInt(process.env.PRICE_SCRAPER_MIN_DELAY_MS || '3000', 10),
  maxDelayMs: parseInt(process.env.PRICE_SCRAPER_MAX_DELAY_MS || '7000', 10),
  apiMinDelayMs: parseInt(process.env.PRICE_SCRAPER_API_MIN_DELAY_MS || '800', 10),
  apiMaxDelayMs: parseInt(process.env.PRICE_SCRAPER_API_MAX_DELAY_MS || '2000', 10),
  maxProductsPerMarket: parseInt(process.env.PRICE_SCRAPER_MAX_PRODUCTS || '300', 10),
  migrosMaxPagesPerTerm: parseInt(process.env.PRICE_SCRAPER_MIGROS_MAX_PAGES || '3', 10),
  requestTimeoutMs: parseInt(process.env.PRICE_SCRAPER_TIMEOUT_MS || '15000', 10),

  nameSelector: process.env.PRICE_SCRAPER_NAME_SELECTOR || '.product-name',
  priceSelector: process.env.PRICE_SCRAPER_PRICE_SELECTOR || '.product-price',

  userAgent:
    process.env.PRICE_SCRAPER_USER_AGENT
    || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
}));
