// =====================================================
// Market veri saglayici arayuzu
// =====================================================

import { ScraperType } from '@prisma/client';

export interface ScrapedMarketProduct {
  name: string;
  priceKurus: number;
  brand?: string;
  sourceUrl: string;
  externalSku?: string;
  imageUrl?: string;
  description?: string;
  unit?: string;
  unitValue?: number;
  keywords?: string[];
  /** Kaynaktan gelen yaprak kategori adı (ör. Migros: "Çamaşır Deterjanı") */
  categoryName?: string;
  /** Kaynaktan gelen üst kategori adları (ör. Migros: ["Temizlik"]) */
  categoryParents?: string[];
}

/** Scraper calistirma baglami — market DB kaydindan doldurulur */
export interface MarketScrapeContext {
  marketId: string;
  marketName: string;
  marketSlug: string;
  scraperType: ScraperType | null;
  sitemapUrl: string | null;
  nameSelector: string;
  priceSelector: string;
  urlPattern?: string | null;
  maxProducts: number;
}

/** Saglayici toplama sonucu — basarisiz linkler ayri raporlanir */
export interface ScrapeCollectionResult {
  products: ScrapedMarketProduct[];
  scrapeFailed: number;
  scrapeErrors: string[];
}

export interface MarketDataProvider {
  supports(ctx: Pick<MarketScrapeContext, 'marketSlug' | 'scraperType' | 'sitemapUrl'>): boolean;
  collectProducts(ctx: MarketScrapeContext): Promise<ScrapeCollectionResult>;
}
