// =====================================================
// Market -> veri saglayici eslemesi
// =====================================================

import { Injectable } from '@nestjs/common';
import { ScraperType } from '@prisma/client';
import { MarketDataProvider } from '../interfaces/market-data-provider.interface';
import { MigrosApiProvider } from './migros-api.provider';
import { SitemapHtmlProvider } from './sitemap-html.provider';

export interface MarketScraperConfig {
  slug: string;
  scraperType: ScraperType | null;
  sitemapUrl: string | null;
}

@Injectable()
export class MarketProviderRegistry {
  private readonly providers: MarketDataProvider[];

  constructor(
    migrosApi: MigrosApiProvider,
    sitemapHtml: SitemapHtmlProvider,
  ) {
    // Oncelik: API saglayicilari -> sitemap HTML
    this.providers = [migrosApi, sitemapHtml];
  }

  resolve(market: MarketScraperConfig): MarketDataProvider | null {
    const ctx = {
      marketSlug: market.slug,
      scraperType: market.scraperType,
      sitemapUrl: market.sitemapUrl,
    };
    return this.providers.find((p) => p.supports(ctx)) ?? null;
  }

  /** API ile otomatik calisan market slug'lari */
  getApiMarketSlugs(): string[] {
    return ['migros'];
  }
}
