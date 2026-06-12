// =====================================================
// Migros Sanal Market API saglayicisi
// rest.migros.com.tr uzerinden canli urun ve fiyat ceker
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScraperType } from '@prisma/client';
import { ScraperHttpClient } from '../clients/scraper-http.client';
import { randomDelay, parseUnitFromProductName } from '../utils/scraper.utils';
import {
  MarketDataProvider, MarketScrapeContext, ScrapeCollectionResult,
} from '../interfaces/market-data-provider.interface';

const MIGROS_API_BASE = 'https://rest.migros.com.tr/sanalmarket';

/** Migros arama API'sinde kapsam icin kullanilan Turkce anahtar kelimeler */
const DEFAULT_SEARCH_TERMS = [
  'sut', 'peynir', 'yogurt', 'ekmek', 'yumurta', 'makarna', 'pirinc', 'bulgur',
  'zeytinyagi', 'aycicek', 'salca', 'cay', 'kahve', 'su', 'meyve suyu', 'kola',
  'deterjan', 'sampuan', 'dis macunu', 'tuvalet kagidi', 'pecete', 'biskuvi',
  'cikolata', 'gofret', 'cips', 'kiyma', 'tavuk', 'sucuk', 'sosis', 'balik',
  'domates', 'salatalik', 'elma', 'muz', 'patates', 'sogan', 'biber', 'marul',
  'dondurma', 'tereyagi', 'krema', 'bal', 'recel', 'tahin', 'pekmez', 'un',
  'seker', 'tuz', 'baharat', 'konserve', 'bebek bezi', 'islak mendil',
];

interface MigrosSearchItem {
  sku: string;
  name: string;
  shownPrice?: number;
  regularPrice?: number;
  prettyName?: string;
  brand?: { name?: string };
  category?: { name?: string };
  categoryAscendants?: { name?: string }[];
  images?: { urls?: Record<string, string> }[];
}

interface MigrosSearchResponse {
  successful?: boolean;
  data?: {
    pageCount?: number;
    storeProductInfos?: MigrosSearchItem[];
  };
}

@Injectable()
export class MigrosApiProvider implements MarketDataProvider {
  private readonly logger = new Logger(MigrosApiProvider.name);

  constructor(
    private readonly http: ScraperHttpClient,
    private readonly config: ConfigService,
  ) {}

  supports(ctx: Pick<MarketScrapeContext, 'marketSlug' | 'scraperType'>): boolean {
    return ctx.scraperType === ScraperType.MIGROS_API || ctx.marketSlug === 'migros';
  }

  async collectProducts(ctx: MarketScrapeContext): Promise<ScrapeCollectionResult> {
    const terms = this.config.get<string[]>('scraper.migrosSearchTerms', DEFAULT_SEARCH_TERMS);
    const pageSize = 30;
    const maxPagesPerTerm = this.config.get<number>('scraper.migrosMaxPagesPerTerm', 3);
    const minDelay = this.config.get<number>('scraper.apiMinDelayMs', 800);
    const maxDelay = this.config.get<number>('scraper.apiMaxDelayMs', 2000);

    const seen = new Set<string>();
    const products: ScrapeCollectionResult['products'] = [];
    const scrapeErrors: string[] = [];
    let scrapeFailed = 0;

    for (const term of terms) {
      if (products.length >= ctx.maxProducts) break;

      for (let page = 0; page < maxPagesPerTerm; page++) {
        if (products.length >= ctx.maxProducts) break;

        await randomDelay(minDelay, maxDelay);

        const url = `${MIGROS_API_BASE}/products/search?q=${encodeURIComponent(term)}&page=${page}&size=${pageSize}`;
        let payload: MigrosSearchResponse;

        try {
          payload = await this.http.fetchJson<MigrosSearchResponse>(url);
        } catch (err) {
          scrapeFailed++;
          scrapeErrors.push(`${term}/p${page}: ${(err as Error).message}`);
          this.logger.warn(`Migros API hata (${term}, sayfa ${page}): ${(err as Error).message}`);
          break;
        }

        const items = payload.data?.storeProductInfos ?? [];
        if (items.length === 0) break;

        for (const item of items) {
          if (products.length >= ctx.maxProducts) break;
          if (!item.sku || seen.has(item.sku)) continue;

          const priceKurus = item.shownPrice ?? item.regularPrice;
          if (!item.name || !priceKurus || priceKurus <= 0) continue;

          seen.add(item.sku);
          const imageUrl = item.images?.[0]?.urls?.PRODUCT_HD
            ?? item.images?.[0]?.urls?.PRODUCT_DETAIL
            ?? item.images?.[0]?.urls?.PRODUCT_LIST;
          const parsedUnit = parseUnitFromProductName(item.name.trim());
          const categoryParents = (item.categoryAscendants ?? [])
            .map((a) => a.name?.trim())
            .filter((n): n is string => Boolean(n));
          products.push({
            name: item.name.trim(),
            priceKurus,
            brand: item.brand?.name?.trim(),
            externalSku: item.sku,
            sourceUrl: `https://www.migros.com.tr/${item.prettyName || item.sku}-p-${item.sku}`,
            imageUrl,
            unit: parsedUnit?.unit,
            unitValue: parsedUnit?.unitValue,
            categoryName: item.category?.name?.trim(),
            categoryParents,
          });
        }

        const pageCount = payload.data?.pageCount ?? 1;
        if (page + 1 >= pageCount) break;
      }
    }

    this.logger.log(`[Migros API] ${products.length} benzersiz urun toplandi`);
    return { products, scrapeFailed, scrapeErrors };
  }
}
