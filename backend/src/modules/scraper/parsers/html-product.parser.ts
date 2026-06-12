// =====================================================
// Urun sayfasi HTML parser
// 1) cheerio CSS selector (.product-name / .product-price)
// 2) JSON-LD Product schema (A101, SPA siteler)
// 3) microdata itemprop fallback
// =====================================================

import * as cheerio from 'cheerio';
import { parsePriceToKurus } from '../utils/scraper.utils';

export interface ScrapedProductData {
  name: string;
  priceKurus: number;
  sourceUrl: string;
}

export interface HtmlParserOptions {
  nameSelector: string;
  priceSelector: string;
}

/** JSON-LD veya microdata'dan urun bilgisi cikar */
function parseStructuredData($: cheerio.CheerioAPI): { name?: string; priceText?: string } {
  let name: string | undefined;
  let priceText: string | undefined;

  $('script[type="application/ld+json"]').each((_, el) => {
    if (name && priceText) return;
    try {
      const raw = $(el).html();
      if (!raw) return;
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const product = node['@type'] === 'Product' ? node : node['@graph']?.find(
          (g: { '@type'?: string }) => g['@type'] === 'Product',
        );
        if (!product) continue;
        name = name || product.name?.trim();
        const offer = product.offers
          ?? (Array.isArray(product.offers) ? product.offers[0] : undefined);
        priceText = priceText || String(offer?.price ?? offer?.lowPrice ?? '');
      }
    } catch {
      // gecersiz JSON-LD atla
    }
  });

  if (!name) name = $('[itemprop="name"]').first().text().trim() || undefined;
  if (!priceText) {
    priceText = $('[itemprop="price"]').attr('content')
      || $('[itemprop="price"]').first().text().trim()
      || undefined;
  }

  return { name, priceText };
}

/**
 * HTML sayfasindan urun adi ve fiyatini cikarir.
 * Selector eslesmezse JSON-LD / microdata denenir.
 */
export function parseProductFromHtml(
  html: string,
  sourceUrl: string,
  options: HtmlParserOptions,
): ScrapedProductData | null {
  const $ = cheerio.load(html);

  let name = $(options.nameSelector).first().text().trim();
  let priceText = $(options.priceSelector).first().text().trim();

  // Alternatif yaygin selector'lar
  if (!name) name = $('h1').first().text().trim();
  if (!priceText) {
    priceText = $('.price, .product-price, .sales-price, [class*="Price"]').first().text().trim();
  }

  if (!name || !priceText) {
    const structured = parseStructuredData($);
    name = name || structured.name || '';
    priceText = priceText || structured.priceText || '';
  }

  if (!name) return null;

  const priceKurus = parsePriceToKurus(priceText);
  if (priceKurus === null) return null;

  return { name, priceKurus, sourceUrl };
}
