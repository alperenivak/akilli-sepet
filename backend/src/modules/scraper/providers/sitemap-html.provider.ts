// =====================================================
// Sitemap + HTML Cheerio Saglayicisi
//
// Is akisi (spec):
// 1. sitemap.xml indir -> cheerio ile <loc> linkleri
// 2. Her linke 3-7 sn rastgele delay + tarayici User-Agent
// 3. cheerio ile .product-name / .product-price (market bazli ozellestirilebilir)
// 4. Link hatasi (404 vb.) loglanir, dongu devam eder
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScraperType } from '@prisma/client';
import { ScraperHttpClient } from '../clients/scraper-http.client';
import {
  isSitemapIndex, parseLocUrlsFromSitemap, parseSitemapIndexUrls,
} from '../parsers/sitemap.parser';
import { parseProductFromHtml } from '../parsers/html-product.parser';
import { randomDelay } from '../utils/scraper.utils';
import {
  MarketDataProvider, MarketScrapeContext, ScrapeCollectionResult,
} from '../interfaces/market-data-provider.interface';

@Injectable()
export class SitemapHtmlProvider implements MarketDataProvider {
  private readonly logger = new Logger(SitemapHtmlProvider.name);

  constructor(
    private readonly http: ScraperHttpClient,
    private readonly config: ConfigService,
  ) {}

  supports(ctx: Pick<MarketScrapeContext, 'scraperType' | 'sitemapUrl'>): boolean {
    return ctx.scraperType === ScraperType.SITEMAP_HTML && !!ctx.sitemapUrl;
  }

  async collectProducts(ctx: MarketScrapeContext): Promise<ScrapeCollectionResult> {
    if (!ctx.sitemapUrl) {
      throw new Error('Sitemap URL tanimli degil');
    }

    const minDelay = this.config.get<number>('scraper.minDelayMs', 3000);
    const maxDelay = this.config.get<number>('scraper.maxDelayMs', 7000);
    const products: ScrapeCollectionResult['products'] = [];
    const scrapeErrors: string[] = [];
    let scrapeFailed = 0;

    // ---- Adim 1: Sitemap oku (index destegi dahil) ----
    this.logger.log(`[${ctx.marketName}] Sitemap okunuyor: ${ctx.sitemapUrl}`);
    const rootXml = await this.http.fetchText(ctx.sitemapUrl);
    let productLinks = await this.resolveProductLinks(rootXml, ctx);

    productLinks = productLinks.slice(0, ctx.maxProducts);
    this.logger.log(`[${ctx.marketName}] ${productLinks.length} urun linki bulundu`);

    // ---- Adim 2-4: Her link icin guvenli istek + cheerio parse ----
    for (const url of productLinks) {
      try {
        // Anti-ban: rastgele 3-7 saniye bekleme
        await randomDelay(minDelay, maxDelay);

        const html = await this.http.fetchText(url);
        const scraped = parseProductFromHtml(html, url, {
          nameSelector: ctx.nameSelector,
          priceSelector: ctx.priceSelector,
        });

        if (!scraped) {
          scrapeFailed++;
          scrapeErrors.push(`Parse basarisiz (selector eslesmedi): ${url}`);
          this.logger.warn(`[${ctx.marketName}] Parse basarisiz: ${url}`);
          continue;
        }

        products.push({
          name: scraped.name,
          priceKurus: scraped.priceKurus,
          sourceUrl: scraped.sourceUrl,
        });
      } catch (err) {
        // Tek link hatasi tum islemi durdurmaz
        scrapeFailed++;
        const msg = `${url}: ${(err as Error).message}`;
        scrapeErrors.push(msg);
        this.logger.warn(`[${ctx.marketName}] Link atlandi — ${msg}`);
      }
    }

    return { products, scrapeFailed, scrapeErrors };
  }

  /**
   * Sitemap veya sitemap index'ten urun URL listesi uretir.
   * Sitemap index varsa tum urun sitemaplarini indirir ve her birinden
   * dengeli ornekleme yapar — boylece tum kategorilerden urun alinir.
   */
  private async resolveProductLinks(rootXml: string, ctx: MarketScrapeContext): Promise<string[]> {
    const parseOpts = {
      urlPattern: ctx.urlPattern ?? undefined,
    };

    if (!isSitemapIndex(rootXml)) {
      const links = parseLocUrlsFromSitemap(rootXml, parseOpts);
      return this.sampleLinks(links, ctx.maxProducts);
    }

    // Sitemap index: once urun sitemaplarini (product iceren) al, sonra geri kalanlar
    const allChildSitemaps = parseSitemapIndexUrls(rootXml);
    const productSitemaps = allChildSitemaps.filter(u => /product/i.test(u));
    const orderedChildren = productSitemaps.length > 0
      ? [...productSitemaps, ...allChildSitemaps.filter(u => !/product/i.test(u))]
      : allChildSitemaps;

    // Tum urun sitemaplarini indir (maksimum 8 child sitemap)
    const allLinksPerSitemap: string[][] = [];

    for (const childUrl of orderedChildren.slice(0, 8)) {
      try {
        await randomDelay(800, 1500);
        const childXml = await this.http.fetchText(childUrl);
        const links = parseLocUrlsFromSitemap(childXml, parseOpts);
        if (links.length > 0) {
          allLinksPerSitemap.push(links);
          this.logger.log(`[${ctx.marketName}] Alt sitemap: ${childUrl} — ${links.length} link`);
        } else {
          this.logger.debug(`[${ctx.marketName}] Alt sitemap bos (URL filtresi eslesmedi): ${childUrl}`);
        }
      } catch (err) {
        this.logger.warn(`[${ctx.marketName}] Alt sitemap atlandi: ${childUrl}`);
      }
    }

    if (allLinksPerSitemap.length === 0) return [];

    // Her sitemaptan dengeli oranlarda urun sec — farkli kategorilerden kapsam
    const totalAvailable = allLinksPerSitemap.reduce((s, l) => s + l.length, 0);
    const sampled: string[] = [];

    for (const links of allLinksPerSitemap) {
      // Bu sitemaptan alinacak link orani (toplam havuza gore agirlikli)
      const quota = Math.ceil((links.length / totalAvailable) * ctx.maxProducts);
      sampled.push(...this.sampleLinks(links, quota));
    }

    const uniqueLinks = [...new Set(sampled)];
    this.logger.log(`[${ctx.marketName}] ${uniqueLinks.length} urun linki secildi (${allLinksPerSitemap.length} sitemaptan dengeli)`);
    return uniqueLinks.slice(0, ctx.maxProducts);
  }

  /**
   * Buyuk bir liste icinden rastgele ornekleme yapar.
   * Ornek: 5000 URL'den 100 tane sec — her 50'de bir al gibi
   * Boylece listenin basindaki tek kategoriye takilmayiz.
   */
  private sampleLinks(links: string[], maxCount: number): string[] {
    if (links.length <= maxCount) return links;
    // Sistematik ornekleme: esdeger aralikla sec (random offset ile)
    const step = Math.floor(links.length / maxCount);
    const offset = Math.floor(Math.random() * step);
    const result: string[] = [];
    for (let i = offset; i < links.length && result.length < maxCount; i += step) {
      result.push(links[i]);
    }
    return result;
  }
}
