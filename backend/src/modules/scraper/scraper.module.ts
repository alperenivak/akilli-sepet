// =====================================================
// Fiyat Scraper Modulu
// Cron + sitemap + cheerio + PriceHistory entegrasyonu
// =====================================================

import { Module } from '@nestjs/common';
import { PriceScraperService } from './price-scraper.service';
import { PriceScraperCronService } from './price-scraper.cron';
import { ScraperBootstrapService } from './scraper-bootstrap.service';
import { ScraperHttpClient } from './clients/scraper-http.client';
import { ScraperController } from './scraper.controller';
import { MigrosApiProvider } from './providers/migros-api.provider';
import { SitemapHtmlProvider } from './providers/sitemap-html.provider';
import { MarketProviderRegistry } from './providers/market-provider.registry';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [PricesModule],
  controllers: [ScraperController],
  providers: [
    PriceScraperService,
    PriceScraperCronService,
    ScraperBootstrapService,
    ScraperHttpClient,
    MigrosApiProvider,
    SitemapHtmlProvider,
    MarketProviderRegistry,
  ],
  exports: [PriceScraperService],
})
export class ScraperModule {}
