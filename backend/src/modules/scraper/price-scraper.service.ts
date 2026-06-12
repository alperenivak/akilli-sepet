// =====================================================
// Fiyat Scraper ve Fiyat Gecmisi Servisi
//
// Is akisi:
// 1. Cron (03:00) veya manuel tetikleme
// 2. Market saglayicisi urun+fiyat toplar (sitemap/cheerio veya API)
// 3. DB karsilastirma:
//    - Urun yoksa -> yeni Product
//    - Fiyat degisti -> Price guncelle + PriceHistory insert (PricesService)
// 4. Link/API hatalari loglanir, islem devam eder
// =====================================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceSource, ScraperType } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { PricesService } from '../prices/prices.service';
import { PriceCoverageService } from '../prices/price-coverage.service';
import { MarketProviderRegistry } from './providers/market-provider.registry';
import { ScrapedMarketProduct, MarketScrapeContext } from './interfaces/market-data-provider.interface';
import { slugifyName, parseUnitFromProductName } from './utils/scraper.utils';
import { mapProductToCategory, resolveCategoryId } from './utils/category-mapper';

export interface ScraperRunResult {
  marketId: string;
  marketName: string;
  provider: string;
  totalLinks: number;
  processed: number;
  createdProducts: number;
  updatedPrices: number;
  unchanged: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class PriceScraperService {
  private readonly logger = new Logger(PriceScraperService.name);
  private readonly activeJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricesService: PricesService,
    private readonly priceCoverage: PriceCoverageService,
    private readonly registry: MarketProviderRegistry,
    private readonly config: ConfigService,
  ) {}

  /** Scraper durumu ozeti */
  async getStatus() {
    const enabled = this.config.get<boolean>('scraper.enabled', false);
    const markets = await this.prisma.market.findMany({
      where: { isActive: true, scraperEnabled: true },
      select: {
        id: true, name: true, slug: true, scraperType: true,
        sitemapUrl: true, scraperNameSelector: true, scraperPriceSelector: true,
      },
    });

    const lastLog = await this.prisma.dataSyncLog.findFirst({
      where: { jobType: 'PRICE_SCRAPER' },
      orderBy: { startedAt: 'desc' },
    });

    return {
      enabled,
      cron: '0 3 * * *',
      syncOnStartup: this.config.get<boolean>('scraper.syncOnStartup', false),
      activeJobs: [...this.activeJobs],
      markets: markets.map((m) => ({
        ...m,
        provider: this.registry.resolve(m)?.constructor.name ?? null,
      })),
      lastRun: lastLog,
    };
  }

  /** Tum scraperEnabled marketler icin calistir */
  async runAllEnabledMarkets(): Promise<ScraperRunResult[]> {
    if (this.activeJobs.size > 0) {
      throw new Error('Scraper zaten calisiyor');
    }

    const markets = await this.findScraperMarkets();
    if (markets.length === 0) {
      this.logger.warn('Scraper etkin market bulunamadi');
      return [];
    }

    this.activeJobs.add('__all__');
    const results: ScraperRunResult[] = [];

    try {
      for (const market of markets) {
        try {
          results.push(await this.executeMarketScrape(market.id));
        } catch (err) {
          this.logger.error(`Market scraper hatasi (${market.name}): ${(err as Error).message}`);
          results.push({
            marketId: market.id,
            marketName: market.name,
            provider: 'unknown',
            totalLinks: 0,
            processed: 0,
            createdProducts: 0,
            updatedPrices: 0,
            unchanged: 0,
            failed: 1,
            errors: [(err as Error).message],
          });
        }
      }
    } finally {
      this.activeJobs.delete('__all__');
    }

    return results;
  }

  /** Tek market — disaridan manuel tetikleme */
  async runForMarket(marketId: string): Promise<ScraperRunResult> {
    if (this.activeJobs.has(marketId)) {
      throw new Error('Bu market icin scraper zaten calisiyor');
    }
    if (this.activeJobs.has('__all__')) {
      throw new Error('Toplu scraper calisiyor — lutfen bekleyin');
    }

    this.activeJobs.add(marketId);
    try {
      return await this.executeMarketScrape(marketId);
    } finally {
      this.activeJobs.delete(marketId);
    }
  }

  /** Cekirdek scrape + DB mantigi */
  private async executeMarketScrape(marketId: string): Promise<ScraperRunResult> {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      select: {
        id: true, name: true, slug: true, sitemapUrl: true,
        scraperEnabled: true, isActive: true, scraperType: true,
        scraperNameSelector: true, scraperPriceSelector: true, scraperUrlPattern: true,
      },
    });

    if (!market) throw new NotFoundException('Market bulunamadi');
    if (!market.isActive || !market.scraperEnabled) {
      throw new Error(`Market scraper icin yapilandirilmamis: ${market.name}`);
    }

    const provider = this.registry.resolve(market);
    if (!provider) {
      throw new Error(
        `Veri saglayici yok: ${market.name} — scraperType=${market.scraperType}, sitemapUrl=${market.sitemapUrl ?? 'yok'}`,
      );
    }

    const logId = await this.startSyncLog(market.id, market.name);
    const providerName = provider.constructor.name;

    const result: ScraperRunResult = {
      marketId: market.id,
      marketName: market.name,
      provider: providerName,
      totalLinks: 0,
      processed: 0,
      createdProducts: 0,
      updatedPrices: 0,
      unchanged: 0,
      failed: 0,
      errors: [],
    };

    try {
      const ctx = this.buildScrapeContext(market);
      this.logger.log(`[${market.name}] Veri cekimi basladi (${providerName})`);

      const { products, scrapeFailed, scrapeErrors } = await provider.collectProducts(ctx);
      result.totalLinks = products.length + scrapeFailed;
      result.failed += scrapeFailed;
      result.errors.push(...scrapeErrors.slice(0, 20));

      this.logger.log(`[${market.name}] ${products.length} urun DB'ye yazilacak`);

      const touchedProductIds = new Set<string>();
      for (const item of products) {
        try {
          const upsert = await this.upsertScrapedProduct(market.id, item);
          if (upsert.productId && upsert.productId !== '__skipped__') {
            touchedProductIds.add(upsert.productId);
          }
          result.processed++;
          if (upsert.createdProduct) result.createdProducts++;
          if (upsert.priceUpdated) result.updatedPrices++;
          if (upsert.unchanged) result.unchanged++;
        } catch (err) {
          result.failed++;
          const msg = `${item.sourceUrl}: ${(err as Error).message}`;
          result.errors.push(msg);
          this.logger.warn(`[${market.name}] DB yazim hatasi — ${msg}`);
        }
      }

      if (touchedProductIds.size > 0) {
        const coverage = await this.priceCoverage.ensureCoverageForProducts([...touchedProductIds]);
        this.logger.log(
          `[${market.name}] Fiyat kapsami — ${coverage.productsFixed} urunde `
          + `${coverage.pricesCreated} eksik market fiyati eklendi`,
        );
      }

      const status = result.processed > 0 ? 'success' : (result.failed > 0 ? 'partial' : 'failed');
      await this.completeSyncLog(logId, status, result);
      this.logger.log(
        `[${market.name}] Tamamlandi — islenen: ${result.processed}, yeni: ${result.createdProducts}, `
        + `guncellenen: ${result.updatedPrices}, hata: ${result.failed}`,
      );

      if (result.processed > 0 && this.config.get<boolean>('scraper.deactivateDemoProducts', false)) {
        await this.deactivateUnscrapedProducts();
      }
    } catch (err) {
      await this.completeSyncLog(logId, 'failed', result, (err as Error).message);
      throw err;
    }

    return result;
  }

  private buildScrapeContext(market: {
    id: string;
    name: string;
    slug: string;
    scraperType: ScraperType | null;
    sitemapUrl: string | null;
    scraperNameSelector: string | null;
    scraperPriceSelector: string | null;
    scraperUrlPattern: string | null;
  }): MarketScrapeContext {
    return {
      marketId: market.id,
      marketName: market.name,
      marketSlug: market.slug,
      scraperType: market.scraperType,
      sitemapUrl: market.sitemapUrl,
      nameSelector: market.scraperNameSelector
        ?? this.config.get<string>('scraper.nameSelector', '.product-name'),
      priceSelector: market.scraperPriceSelector
        ?? this.config.get<string>('scraper.priceSelector', '.product-price'),
      urlPattern: market.scraperUrlPattern,
      maxProducts: this.config.get<number>('scraper.maxProductsPerMarket', 300),
    };
  }

  /** Carrefour -> A101 -> diger marketler sirasi */
  private static readonly SCRAPE_ORDER = ['migros', 'a101', 'macrocenter', 'carrefoursa', 'bim', 'sok'];

  private async findScraperMarkets() {
    const apiSlugs = this.registry.getApiMarketSlugs();
    const markets = await this.prisma.market.findMany({
      where: {
        isActive: true,
        scraperEnabled: true,
        OR: [
          { scraperType: ScraperType.MIGROS_API },
          { slug: { in: apiSlugs } },
          { scraperType: ScraperType.SITEMAP_HTML, sitemapUrl: { not: null } },
          { sitemapUrl: { not: null } },
        ],
      },
      select: { id: true, name: true, slug: true },
    });

    return markets.sort((a, b) => {
      const ai = PriceScraperService.SCRAPE_ORDER.indexOf(a.slug);
      const bi = PriceScraperService.SCRAPE_ORDER.indexOf(b.slug);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  /**
   * Prisma upsert mantigi:
   * - Urun yoksa -> Product.create
   * - Fiyat degismisse -> Price.update + PriceHistory.create (PricesService)
   */
  private async upsertScrapedProduct(
    marketId: string,
    data: ScrapedMarketProduct,
  ): Promise<{ productId: string; createdProduct: boolean; priceUpdated: boolean; unchanged: boolean }> {
    const normalizedName = data.name.trim();
    // Kanonical slug: birim normalize edilmis, Turkce karakter donusturulmus
    // Ayni urun farkli marketlerde ayni slug'a eslenir
    const canonicalSlug = slugifyName(normalizedName);

    // Once slug ile ara (en guvenilir yontem — farkli yazim formlari ayni slug'a eslenir)
    // Ardindan tam isim karsilastirmasi ile ara
    let product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { slug: canonicalSlug },
          {
            name: { equals: normalizedName, mode: 'insensitive' },
            ...(data.brand && { brand: { equals: data.brand, mode: 'insensitive' } }),
          },
        ],
        isActive: true,
      },
      select: { id: true, slug: true, imageUrl: true, description: true, unit: true },
    });

    let createdProduct = false;
    const parsedUnit = data.unit
      ? { unit: data.unit, unitValue: data.unitValue }
      : parseUnitFromProductName(normalizedName);

    const enrichment: Record<string, unknown> = {};
    if (data.imageUrl) enrichment.imageUrl = data.imageUrl;
    if (data.description) enrichment.description = data.description;
    if (data.brand) enrichment.brand = data.brand;
    if (parsedUnit?.unit) {
      enrichment.unit = parsedUnit.unit;
      enrichment.unitValue = parsedUnit.unitValue;
    }
    if (data.keywords?.length) enrichment.keywords = data.keywords;

    if (!product) {
      // Görseli olmayan yeni ürünleri sisteme ekleme — kaynaktan görsel gelmezse atla
      if (!data.imageUrl) {
        this.logger.debug(`[Scraper] Gorsel yok, urun atlandi: "${normalizedName}"`);
        return { productId: '__skipped__', createdProduct: false, priceUpdated: false, unchanged: true };
      }

      // Kategori mapper: Migros kategori adı → keyword → marka sırasıyla belirle
      const categorySlug = mapProductToCategory(
        normalizedName,
        data.brand,
        data.categoryName,
        data.categoryParents,
      );
      const categoryId = await resolveCategoryId(this.prisma, categorySlug);
      const category = { id: categoryId };

      if (!category) throw new Error('Varsayilan kategori bulunamadi');

      let slug = canonicalSlug || `urun-${Date.now()}`;
      const slugConflict = await this.prisma.product.findUnique({ where: { slug } });
      if (slugConflict) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      product = await this.prisma.product.create({
        data: {
          name: normalizedName,
          slug,
          brand: data.brand,
          categoryId: category.id,
          isActive: true,
          ...enrichment,
        },
        select: { id: true, slug: true, imageUrl: true, description: true, unit: true },
      });
      createdProduct = true;
    } else if (Object.keys(enrichment).length > 0) {
      const patch: Record<string, unknown> = {};
      if (!product.imageUrl && enrichment.imageUrl) patch.imageUrl = enrichment.imageUrl;
      if (!product.description && enrichment.description) patch.description = enrichment.description;
      if (!product.unit && enrichment.unit) {
        patch.unit = enrichment.unit;
        patch.unitValue = enrichment.unitValue;
      }
      if (enrichment.brand) patch.brand = enrichment.brand;
      if (Object.keys(patch).length > 0) {
        await this.prisma.product.update({ where: { id: product.id }, data: patch });
      }
    }

    // Atlanmış ürün — fiyat işlemi yok
    if (product.id === '__skipped__') {
      return { productId: '__skipped__', createdProduct: false, priceUpdated: false, unchanged: true };
    }

    const existingPrice = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId: product.id, marketId } },
    });

    if (existingPrice && existingPrice.amount === data.priceKurus) {
      return { productId: product.id, createdProduct, priceUpdated: false, unchanged: true };
    }

    // Fiyat degisirse PriceHistory otomatik eklenir (prices.service upsertPrice)
    await this.pricesService.upsertPrice({
      productId: product.id,
      marketId,
      amount: data.priceKurus,
      source: PriceSource.SCRAPER,
      isAvailable: true,
    }, { skipCoverage: true });

    return {
      productId: product.id,
      createdProduct,
      priceUpdated: !existingPrice || existingPrice.amount !== data.priceKurus,
      unchanged: false,
    };
  }

  private async deactivateUnscrapedProducts() {
    const updated = await this.prisma.product.updateMany({
      where: {
        isActive: true,
        prices: { none: { source: PriceSource.SCRAPER } },
      },
      data: { isActive: false },
    });
    if (updated.count > 0) {
      this.logger.log(`${updated.count} demo urun pasif yapildi`);
    }
  }

  private async startSyncLog(marketId: string, marketName: string) {
    return this.prisma.dataSyncLog.create({
      data: {
        jobType: 'PRICE_SCRAPER',
        provider: 'SCRAPER',
        status: 'pending',
        metadata: { marketId, marketName },
      },
    }).then((l) => l.id);
  }

  private async completeSyncLog(logId: string, status: string, result: ScraperRunResult, errorMessage?: string) {
    await this.prisma.dataSyncLog.update({
      where: { id: logId },
      data: {
        status,
        recordsTotal: result.totalLinks,
        recordsSuccess: result.processed,
        recordsFailed: result.failed,
        errorMessage,
        metadata: {
          marketId: result.marketId,
          marketName: result.marketName,
          provider: result.provider,
          createdProducts: result.createdProducts,
          updatedPrices: result.updatedPrices,
          unchanged: result.unchanged,
          errors: result.errors.slice(0, 20),
        },
        completedAt: new Date(),
      },
    });
  }
}
