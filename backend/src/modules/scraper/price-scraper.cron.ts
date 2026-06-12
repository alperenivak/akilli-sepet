// =====================================================
// Fiyat Scraper Cron Servisi
// @nestjs/schedule ile her gece 03:00'te otomatik calisir
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PriceScraperService } from './price-scraper.service';

@Injectable()
export class PriceScraperCronService {
  private readonly logger = new Logger(PriceScraperCronService.name);

  constructor(
    private readonly scraper: PriceScraperService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Zamanlanmis gorev — scraperEnabled tum marketlerden fiyat ceker.
   * Migros: REST API | Diger marketler: sitemap.xml + cheerio HTML
   */
  @Cron('0 3 * * *')
  async nightlyPriceScrape() {
    if (!this.config.get<boolean>('scraper.enabled', false)) {
      return;
    }

    this.logger.log('Gece 03:00 fiyat scraper gorevi basladi...');
    try {
      const results = await this.scraper.runAllEnabledMarkets();
      const summary = results.reduce(
        (acc, r) => ({
          processed: acc.processed + r.processed,
          updated: acc.updated + r.updatedPrices,
          failed: acc.failed + r.failed,
        }),
        { processed: 0, updated: 0, failed: 0 },
      );
      this.logger.log(
        `Gece scraper tamamlandi — islenen: ${summary.processed}, `
        + `guncellenen fiyat: ${summary.updated}, hata: ${summary.failed}`,
      );
    } catch (err) {
      this.logger.error(`Gece scraper kritik hata: ${(err as Error).message}`);
    }
  }
}
