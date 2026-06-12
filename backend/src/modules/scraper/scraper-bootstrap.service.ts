// =====================================================
// Scraper baslangic tetikleyicisi
// Backend acildiginda (opsiyonel) ilk canli veri cekimini baslatir
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceScraperService } from './price-scraper.service';

@Injectable()
export class ScraperBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(ScraperBootstrapService.name);

  constructor(
    private readonly scraper: PriceScraperService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<boolean>('scraper.enabled', false);
    const syncOnStartup = this.config.get<boolean>('scraper.syncOnStartup', false);

    if (!enabled || !syncOnStartup) return;

    const delayMs = this.config.get<number>('scraper.startupDelayMs', 15000);
    this.logger.log(`Canli veri cekimi ${delayMs / 1000}s sonra baslayacak...`);

    setTimeout(() => {
      this.scraper.runAllEnabledMarkets()
        .then((results) => {
          const total = results.reduce((a, r) => a + r.processed, 0);
          this.logger.log(`Baslangic veri cekimi tamamlandi — ${total} urun islendi`);
        })
        .catch((err) => {
          this.logger.error(`Baslangic veri cekimi hatasi: ${(err as Error).message}`);
        });
    }, delayMs);
  }
}
