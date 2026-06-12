// =====================================================
// Sitemap.xml parser — cheerio ile <loc> etiketlerinden URL cikarimi
// Standart sitemap + sitemap index (alt sitemap'ler) destekler
// =====================================================

import * as cheerio from 'cheerio';

export interface SitemapParseOptions {
  /** Opsiyonel URL alt dizesi filtresi (orn. "/urun/") */
  urlPattern?: string;
  /** Maksimum link sayisi */
  maxUrls?: number;
}

/**
 * Tek bir sitemap dosyasindan <loc> URL'lerini cikarir.
 */
/**
 * Tek bir sitemap dosyasindan <loc> URL'lerini cikarir.
 *
 * urlPattern desteklenen formatlar:
 *  - Tekil: "/kapida/"         → URL bu alt diziyi icermeli
 *  - Coklu OR: "/kapida/su-icecek|/kapida/atistirmalik"
 *               → URL pipe ile ayrilan segmentlerden EN AZ BIRiNi icermeli
 */
export function parseLocUrlsFromSitemap(xmlContent: string, options: SitemapParseOptions = {}): string[] {
  const $ = cheerio.load(xmlContent, { xmlMode: true });
  const urls: string[] = [];
  const rawPattern = options.urlPattern?.trim();

  // Pipe ile birden fazla pattern varsa OR mantigi, yoksa tekil kontrol
  const patterns = rawPattern
    ? rawPattern.split('|').map(p => p.trim()).filter(Boolean)
    : [];

  $('loc').each((_, el) => {
    const href = $(el).text().trim();
    if (!href.startsWith('http')) return;
    if (patterns.length > 0 && !patterns.some(p => href.includes(p))) return;
    urls.push(href);
  });

  return [...new Set(urls)];
}

/**
 * Sitemap index mi kontrol eder (<sitemapindex> veya alt sitemap <loc>'lari).
 */
export function isSitemapIndex(xmlContent: string): boolean {
  const $ = cheerio.load(xmlContent, { xmlMode: true });
  return $('sitemapindex').length > 0 || ($('sitemap').length > 0 && $('url').length === 0);
}

/**
 * Sitemap index'ten alt sitemap URL'lerini cikarir.
 */
export function parseSitemapIndexUrls(xmlContent: string): string[] {
  const $ = cheerio.load(xmlContent, { xmlMode: true });
  const urls: string[] = [];
  $('sitemap loc, sitemapindex sitemap loc').each((_, el) => {
    const href = $(el).text().trim();
    if (href.startsWith('http')) urls.push(href);
  });
  return [...new Set(urls)];
}

/** Geriye uyumluluk */
export function parseProductUrlsFromSitemap(xmlContent: string): string[] {
  return parseLocUrlsFromSitemap(xmlContent);
}
