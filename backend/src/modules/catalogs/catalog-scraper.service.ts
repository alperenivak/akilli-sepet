// =====================================================
// Aktüel Katalog Scraper Servisi
//
// Kaynak: kimbino.com.tr (Türkiye'nin en büyük
// katalog aggregatör sitesi)
//
// Her market için:
// 1. kimbino listing sayfasını çek → kapak + katalog URL
// 2. Katalog detay sayfasını çek → tüm sayfa görselleri
// 3. DB'de yeni kataloğu oluştur / güncelle
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  market: string;
  created: number;
  updated: number;
  pages: number;
  errors: string[];
}

interface KimbinoPage {
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl?: string;
}

interface KimbinoCatalog {
  title: string;
  coverImageUrl?: string;
  sourceUrl: string;
  startDate: Date;
  endDate: Date;
  pages: KimbinoPage[];
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const HEADERS = { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' };
const BASE_URL = 'https://www.kimbino.com.tr';

const MONTHS_TR: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4,
  haziran: 5, temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

function parseTrDate(text: string): Date | null {
  const m = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTHS_TR[m[2].toLowerCase()];
  if (month === undefined) return null;
  return new Date(parseInt(m[3]), month, parseInt(m[1]));
}

function defaultDate(offsetDays = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ──────────────────────────────────────────────────
// Sayfa görsel URL'leri çıkar
// eu.kimbicdn.com/thumbor/[hash]/.../data/[mkt]/[catId]/[page].jpg
// ──────────────────────────────────────────────────
function extractPageImages(html: string): { catalogId: string; page: number; url: string }[] {
  const results: { catalogId: string; page: number; url: string }[] = [];
  const re = /https:\/\/eu\.kimbicdn\.com\/thumbor\/[^"'\s]+\/com\.tr\/data\/\d+\/(\d+)\/(\d+)\.(?:jpg|jpeg|webp)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    results.push({ catalogId: m[1], page: parseInt(m[2]), url: m[0] });
  }
  return results;
}

// ──────────────────────────────────────────────────
// Katalog detay sayfasından sayfalı görselleri çek
// ──────────────────────────────────────────────────
async function fetchCatalogPages(relativeUrl: string): Promise<KimbinoPage[]> {
  const fullUrl = `${BASE_URL}${relativeUrl}`;
  try {
    const { data: html } = await axios.get<string>(fullUrl, {
      headers: HEADERS,
      timeout: 15000,
    });

    const imgs = extractPageImages(html);
    if (imgs.length === 0) return [];

    // Hangi catalog ID en çok sayfa varsa onu al
    const byId: Record<string, { page: number; url: string }[]> = {};
    for (const img of imgs) {
      if (!byId[img.catalogId]) byId[img.catalogId] = [];
      // Thumbnail URL'leri atla (240x240 içerenler)
      if (!img.url.includes('240x240')) {
        byId[img.catalogId].push({ page: img.page, url: img.url });
      }
    }

    // Thumbnail URL'lerini ayrıca topla
    const thumbRe = /https:\/\/eu\.kimbicdn\.com\/thumbor\/[^"'\s]+240x240[^"'\s]+\/com\.tr\/data\/\d+\/(\d+)\/(\d+)\.(?:jpg|webp)/gi;
    const thumbs: Record<string, string> = {};
    let tm: RegExpExecArray | null;
    while ((tm = thumbRe.exec(html)) !== null) {
      thumbs[`${tm[1]}_${tm[2]}`] = tm[0];
    }

    // En fazla sayfaya sahip catalog ID'yi seç
    let bestId = '';
    let maxPages = 0;
    for (const [id, pages] of Object.entries(byId)) {
      const uniquePages = new Set(pages.map((p) => p.page)).size;
      if (uniquePages > maxPages) {
        maxPages = uniquePages;
        bestId = id;
      }
    }

    if (!bestId || maxPages === 0) return [];

    // Tekrarsız sayfaları sırala
    const seen = new Set<number>();
    const result: KimbinoPage[] = [];
    for (const p of byId[bestId].sort((a, b) => a.page - b.page)) {
      if (!seen.has(p.page)) {
        seen.add(p.page);
        result.push({
          pageNumber: p.page + 1, // kimbino 0-indexed, bizim 1-indexed
          imageUrl: p.url,
          thumbnailUrl: thumbs[`${bestId}_${p.page}`],
        });
      }
    }
    return result;
  } catch {
    return [];
  }
}

@Injectable()
export class CatalogScraperService {
  private readonly logger = new Logger(CatalogScraperService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Ana Giriş ──────────────────────────────────────────

  async scrapeAll(): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    for (const slug of ['a101', 'bim', 'sok', 'migros', 'carrefoursa']) {
      results.push(await this.scrapeMarket(slug));
      await sleep(2000);
    }
    return results;
  }

  async scrapeMarket(slug: string): Promise<ScrapeResult> {
    const config: Record<string, { kimbinoSlug: string; maxCatalogs: number }> = {
      a101:        { kimbinoSlug: 'a101',        maxCatalogs: 3 },
      bim:         { kimbinoSlug: 'bim',         maxCatalogs: 3 },
      sok:         { kimbinoSlug: 'sok-market',  maxCatalogs: 3 },
      migros:      { kimbinoSlug: 'migros',      maxCatalogs: 2 },
      carrefoursa: { kimbinoSlug: 'carrefoursa', maxCatalogs: 2 },
    };

    const cfg = config[slug];
    if (!cfg) return { market: slug, created: 0, updated: 0, pages: 0, errors: [`Tanımsız market: ${slug}`] };

    const result: ScrapeResult = { market: slug, created: 0, updated: 0, pages: 0, errors: [] };

    const market = await this.prisma.market.findFirst({ where: { slug, isActive: true } });
    if (!market) {
      result.errors.push(`Market DB'de bulunamadı: ${slug}`);
      return result;
    }

    try {
      const catalogs = await this.scrapeKimbinoListing(cfg.kimbinoSlug, cfg.maxCatalogs);
      this.logger.log(`[${slug}] ${catalogs.length} katalog bulundu`);

      for (const raw of catalogs) {
        try {
          const existing = await this.prisma.catalog.findFirst({
            where: {
              marketId: market.id,
              startDate: { lte: raw.endDate },
              endDate: { gte: raw.startDate },
            },
          });

          if (existing) {
            const patch: Record<string, unknown> = {};
            if (!existing.coverImageUrl && raw.coverImageUrl) patch.coverImageUrl = raw.coverImageUrl;
            if (!existing.sourceUrl) patch.sourceUrl = raw.sourceUrl;
            if (Object.keys(patch).length > 0) {
              await this.prisma.catalog.update({ where: { id: existing.id }, data: patch });
            }

            if (raw.pages.length > 0) {
              const existingPageCount = await this.prisma.catalogPage.count({ where: { catalogId: existing.id } });
              if (existingPageCount === 0) {
                await this.upsertPages(existing.id, raw.pages);
                result.pages += raw.pages.length;
              }
            }
            result.updated++;
          } else {
            const catalog = await this.prisma.catalog.create({
              data: {
                marketId: market.id,
                title: raw.title,
                coverImageUrl: raw.coverImageUrl,
                sourceUrl: raw.sourceUrl,
                startDate: raw.startDate,
                endDate: raw.endDate,
                isActive: true,
                scrapeSource: 'scraper',
                pageCount: raw.pages.length,
              },
            });

            if (raw.pages.length > 0) {
              await this.upsertPages(catalog.id, raw.pages);
              result.pages += raw.pages.length;
            }
            result.created++;
          }
        } catch (err) {
          result.errors.push(`DB kayıt hatası: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      result.errors.push(`Scrape hatası: ${(err as Error).message}`);
    }

    this.logger.log(`[${slug}] +${result.created} yeni, ~${result.updated} güncellendi, ${result.pages} sayfa`);
    return result;
  }

  // ── kimbino.com.tr Listing Scraper ─────────────────────

  private async scrapeKimbinoListing(kimbinoSlug: string, maxCatalogs: number): Promise<KimbinoCatalog[]> {
    const listingUrl = `${BASE_URL}/${kimbinoSlug}/`;
    const { data: html } = await axios.get<string>(listingUrl, {
      headers: HEADERS,
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const results: KimbinoCatalog[] = [];

    // Katalog detay URL'lerini çıkar (ör. /bim/bim-katalog-xxx-12-06-2026-5256482/)
    const catalogUrlPattern = new RegExp(`href="(\\/${kimbinoSlug}\\/[a-z0-9-]+-\\d{2}-\\d{2}-\\d{4}-\\d+\\/)"`, 'gi');
    const rawHtml = html;
    const urlMatches = new Set<string>();
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = catalogUrlPattern.exec(rawHtml)) !== null) {
      urlMatches.add(urlMatch[1]);
    }

    const catalogUrls = [...urlMatches].slice(0, maxCatalogs);
    this.logger.debug(`[${kimbinoSlug}] ${catalogUrls.length} katalog URL bulundu`);

    // Her katalog URL için detay sayfasını çek
    for (const relUrl of catalogUrls) {
      await sleep(800);
      try {
        const detailRes = await axios.get<string>(`${BASE_URL}${relUrl}`, {
          headers: HEADERS,
          timeout: 15000,
        });
        const detailHtml = detailRes.data;
        const $d = cheerio.load(detailHtml);

        // Başlık
        const title = $d('h1').first().text().trim()
          || $d('title').text().replace(' | Kimbino', '').trim()
          || `${kimbinoSlug.toUpperCase()} Aktüel`;

        // og:image → kapak
        const ogImage = $d('meta[property="og:image"]').attr('content');

        // Tarih aralığını meta description veya h2'den çıkar
        const metaDesc = $d('meta[name="description"]').attr('content') || '';
        const h1Text = $d('h1').first().text();
        const allText = `${h1Text} ${metaDesc}`;

        // Tarihleri parse et
        const dateMatches = allText.match(/(\d{1,2}\s+\w+\s+\d{4})/gi) || [];
        let startDate = defaultDate(0);
        let endDate = defaultDate(7);
        if (dateMatches.length >= 2 && dateMatches[0] && dateMatches[1]) {
          const d1 = parseTrDate(dateMatches[0]);
          const d2 = parseTrDate(dateMatches[1]);
          if (d1) startDate = d1;
          if (d2) endDate = d2;
        } else if (dateMatches.length === 1 && dateMatches[0]) {
          const d1 = parseTrDate(dateMatches[0]);
          if (d1) { startDate = d1; endDate = new Date(d1.getTime() + 7 * 86400000); }
        }

        // URL'den tarih çıkar (/bim/xxx-12-06-2026-123456/)
        const urlDateMatch = relUrl.match(/(\d{2})-(\d{2})-(\d{4})/);
        if (urlDateMatch && startDate.getFullYear() < 2020) {
          startDate = new Date(parseInt(urlDateMatch[3]), parseInt(urlDateMatch[2]) - 1, parseInt(urlDateMatch[1]));
          endDate = new Date(startDate.getTime() + 7 * 86400000);
        }

        // Sayfa görsellerini çıkar
        const pageImgs = extractPageImages(detailHtml);
        const pages: KimbinoPage[] = [];

        // Hangi catalog ID en çok sayfa içeriyor?
        const byId: Record<string, { page: number; url: string }[]> = {};
        for (const img of pageImgs) {
          if (img.url.includes('240x240')) continue; // thumbnail atla
          if (!byId[img.catalogId]) byId[img.catalogId] = [];
          byId[img.catalogId].push({ page: img.page, url: img.url });
        }

        // Thumbnail URL'leri
        const thumbRe = /https:\/\/eu\.kimbicdn\.com\/thumbor\/[^"'\s]+240x240[^"'\s]+\/com\.tr\/data\/\d+\/(\d+)\/(\d+)\.(?:jpg|webp)/gi;
        const thumbs: Record<string, string> = {};
        let tm: RegExpExecArray | null;
        while ((tm = thumbRe.exec(detailHtml)) !== null) {
          thumbs[`${tm[1]}_${tm[2]}`] = tm[0];
        }

        let bestId = '';
        let maxPg = 0;
        for (const [id, pgs] of Object.entries(byId)) {
          const uniq = new Set(pgs.map((p) => p.page)).size;
          if (uniq > maxPg) { maxPg = uniq; bestId = id; }
        }

        if (bestId && maxPg > 0) {
          const seen = new Set<number>();
          for (const p of (byId[bestId] || []).sort((a, b) => a.page - b.page)) {
            if (!seen.has(p.page)) {
              seen.add(p.page);
              pages.push({
                pageNumber: p.page + 1,
                imageUrl: p.url,
                thumbnailUrl: thumbs[`${bestId}_${p.page}`],
              });
            }
          }
        }

        // Kapak görseli
        const coverImageUrl = ogImage
          || pages[0]?.imageUrl
          || undefined;

        results.push({
          title: title.substring(0, 200),
          coverImageUrl,
          sourceUrl: `${BASE_URL}${relUrl}`,
          startDate,
          endDate,
          pages,
        });

        this.logger.debug(`[${kimbinoSlug}] "${title.substring(0, 60)}" — ${pages.length} sayfa, kapak: ${!!coverImageUrl}`);
      } catch (err) {
        this.logger.warn(`[${kimbinoSlug}] ${relUrl} çekilemedi: ${(err as Error).message}`);
      }
    }

    return results;
  }

  // ── DB Yardımcıları ────────────────────────────────────

  private async upsertPages(catalogId: string, pages: KimbinoPage[]) {
    for (const p of pages) {
      await this.prisma.catalogPage.upsert({
        where: { catalogId_pageNumber: { catalogId, pageNumber: p.pageNumber } },
        create: { catalogId, ...p },
        update: { imageUrl: p.imageUrl, thumbnailUrl: p.thumbnailUrl },
      });
    }
    await this.prisma.catalog.update({
      where: { id: catalogId },
      data: { pageCount: pages.length },
    });
  }
}
