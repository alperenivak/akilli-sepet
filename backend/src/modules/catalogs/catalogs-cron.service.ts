import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CatalogScraperService } from './catalog-scraper.service';
import { CatalogsService } from './catalogs.service';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class CatalogsCronService implements OnModuleInit {
  private readonly logger = new Logger(CatalogsCronService.name);

  constructor(
    private readonly scraper: CatalogScraperService,
    private readonly catalogs: CatalogsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Uygulama başladığında sayfası olmayan aktif katalogları doldur.
   * Her deploy sonrası veya yeniden başlatmada çalışır.
   */
  async onModuleInit() {
    const emptyCatalogs = await this.prisma.catalog.count({
      where: { isActive: true, pageCount: 0 },
    });
    if (emptyCatalogs > 0) {
      this.logger.log(`${emptyCatalogs} boş katalog bulundu — scrape tetikleniyor...`);
      // Arka planda başlat; başlatmayı bloklamasın
      setImmediate(() => {
        this.scraper.scrapeAll()
          .then((results) => {
            const t = results.reduce((a, r) => ({ c: a.c + r.created, p: a.p + r.pages }), { c: 0, p: 0 });
            this.logger.log(`Başlangıç scrape tamamlandı — +${t.c} katalog, ${t.p} sayfa`);
          })
          .catch((e) => this.logger.error('Başlangıç scrape hatası', e));
      });
    }
  }

  /** Her Pazartesi 09:00 — tüm marketlerin aktüel kataloglarını çek */
  @Cron('0 9 * * 1')
  async scrapeWeeklyCatalogs() {
    this.logger.log('Haftalık katalog scrape başladı...');
    const results = await this.scraper.scrapeAll();
    const totals = results.reduce(
      (acc, r) => ({ created: acc.created + r.created, pages: acc.pages + r.pages }),
      { created: 0, pages: 0 },
    );
    this.logger.log(`Haftalık scrape tamamlandı — +${totals.created} katalog, ${totals.pages} sayfa`);
  }

  /** Her gece 02:00 — süresi dolan katalogları pasife al */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async deactivateExpiredCatalogs() {
    const { count } = await this.catalogs.deactivateExpired();
    if (count > 0) {
      this.logger.log(`${count} süresi dolmuş katalog pasife alındı`);
    }
  }
}
