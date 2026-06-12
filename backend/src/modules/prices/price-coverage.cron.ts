// =====================================================
// Fiyat Kapsami — Gunluk bakim cron'u
// Scraper (03:00) sonrasi eksik market fiyatlarini tamamlar
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PriceCoverageService } from './price-coverage.service';

@Injectable()
export class PriceCoverageCronService {
  private readonly logger = new Logger(PriceCoverageCronService.name);

  constructor(private readonly coverage: PriceCoverageService) {}

  /** Her gece 04:30 — scraper sonrasi kapsam kontrolu */
  @Cron('30 4 * * *')
  async repairNightlyCoverage(): Promise<void> {
    this.logger.log('Gunluk fiyat kapsami bakimi basladi');
    try {
      const singleBefore = await this.coverage.countSingleMarketProducts();
      const result = await this.coverage.repairIncompleteCoverage();
      const singleAfter = await this.coverage.countSingleMarketProducts();
      this.logger.log(
        `Gunluk kapsam bakimi tamamlandi — duzeltilen: ${result.productsFixed}, `
        + `tek market: ${singleBefore} → ${singleAfter}`,
      );
    } catch (err) {
      this.logger.error(`Kapsam bakimi hatasi: ${(err as Error).message}`);
    }
  }
}
