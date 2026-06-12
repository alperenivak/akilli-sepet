// =====================================================
// Görselsiz Ürün Zenginleştirme — 2. Geçiş
// Daha agresif eşleşme + DuckDuckGo görsel yedek
// npm run seed:enrich-missing
// =====================================================

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeName, parseUnitFromName } from './lib/product-enrichment';

const prisma = new PrismaClient();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const MIGROS_SEARCH = 'https://rest.migros.com.tr/sanalmarket/products/search';
const OFF_SEARCH = 'https://world.openfoodfacts.org/api/v2/search';
const DDG_URL = 'https://duckduckgo.com/';
const DDG_IMG = 'https://duckduckgo.com/i.js';

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function tokenScore(a: string, b: string): number {
  if (a === b) return 1;
  const ta = new Set(a.split(' ').filter((t) => t.length > 1));
  const tb = b.split(' ').filter((t) => t.length > 1);
  if (!ta.size || !tb.length) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit++;
  const union = new Set([...ta, ...tb]).size;
  return hit / union;
}

/** Ürün adından olası marka çıkarma — ilk büyük harfli kelime(ler) */
function guessBrand(name: string): string | null {
  const words = name.split(/\s+/);
  // Bilinen markalar — ilk eşleşen
  const KNOWN = [
    'Algida','Coca-Cola','Cappy','Ahmad','Alpro','Banvit','Bonduelle','Bonne',
    'Arko','Axe','Bioblas','Biomed','Danone','Dardanel','Derby','Dimes',
    'Cornetto','Castello','Champion','Cafex','Calvados','Calgon','Bref',
    'Bupiliç','Besler','Aktivia','Activia','Coşkun','De Cecco','Aptamil',
    'Arizona','Barch','Haribo','Head','Colgate','Fairy','Ariel','Comfort',
    'Yudum','Torku','Ülker','Pınar','Sütaş','İçim','Sek','Migros','Kerevitaş',
    'Barilla','Bonduelle','Nestlé','Nestle','Knorr','Maggi','Eti','Pastavilla',
    'Tukaş','Komili','Trakya','Coke','Pepsi','Fanta','Sprite','Monster',
    'Redbull','Booly','Dankek','Cornetto','Bolca','Superfresh',
  ];
  const nameLower = name.toLowerCase();
  for (const k of KNOWN) {
    if (nameLower.includes(k.toLowerCase())) return k;
  }
  // İlk büyük harfli kelimeler (Türkçe isim kalıbı)
  const capWords = words.filter((w) => /^[A-ZÇĞİÖŞÜA-Z]/.test(w) && w.length > 1);
  if (capWords.length >= 1 && capWords.length <= 2) return capWords.join(' ');
  return null;
}

/** Ürün adından birim + rakamları temizle */
function stripUnits(name: string): string {
  return name
    .replace(/\d+(?:[.,]\d+)?\s*(?:litre|liter|lt|l|kg|g|gr|gram|ml|adet|adt|li|cl)\b/gi, '')
    .replace(/\d+\s*[xX×]\s*\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Migros ───────────────────────────────────────────────────────────────────

interface MigrosItem {
  name?: string;
  brand?: { name?: string };
  category?: { name?: string };
  categoryAscendants?: { name?: string }[];
  images?: { urls?: Record<string, string> }[];
}

async function searchMigros(q: string): Promise<MigrosItem[]> {
  await sleep(700 + Math.random() * 600);
  try {
    const { data } = await axios.get<{ data?: { storeProductInfos?: MigrosItem[] } }>(
      MIGROS_SEARCH,
      {
        params: { q, page: 0, size: 10 },
        timeout: 18_000,
        headers: { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.migros.com.tr/' },
      },
    );
    return data.data?.storeProductInfos ?? [];
  } catch {
    return [];
  }
}

function migrosImage(item: MigrosItem): string | undefined {
  const u = item.images?.[0]?.urls;
  return u?.PRODUCT_HD ?? u?.PRODUCT_DETAIL ?? u?.PRODUCT_LIST;
}

/** Migros araması — birden fazla sorgu varyantı + düşük eşik */
async function tryMigros(name: string, existingBrand?: string | null): Promise<{ imageUrl: string; brand?: string } | null> {
  const guessedBrand = existingBrand ?? guessBrand(name);
  const stripped = stripUnits(name);
  const short = stripped.split(/\s+/).slice(0, 4).join(' ');

  const queries = [...new Set([
    name,
    stripped,
    guessedBrand ? `${guessedBrand} ${stripped}` : null,
    guessedBrand ? guessedBrand : null,
    short,
    guessedBrand ? `${guessedBrand} ${short}` : null,
  ].filter(Boolean) as string[])];

  for (const q of queries) {
    const items = await searchMigros(q);
    if (!items.length) continue;

    const target = normalizeName(name);
    let best: MigrosItem | null = null;
    let bestScore = 0;

    for (const item of items) {
      if (!item.name) continue;
      const cand = normalizeName(item.name);
      if (cand === target) { best = item; bestScore = 1; break; }
      let score = tokenScore(target, cand);
      // marka bonus
      const itemBrand = item.brand?.name ? normalizeName(item.brand.name) : '';
      const gb = guessedBrand ? normalizeName(guessedBrand) : '';
      if (gb && itemBrand && (itemBrand.includes(gb) || gb.includes(itemBrand))) score += 0.15;
      if (score > bestScore) { bestScore = score; best = item; }
    }

    // Eşik: resim varsa 0.42, yoksa 0.55
    const threshold = 0.42;
    if (best && bestScore >= threshold) {
      const img = migrosImage(best);
      if (img) return { imageUrl: img, brand: best.brand?.name?.trim() };
    }
  }
  return null;
}

// ─── Open Food Facts ──────────────────────────────────────────────────────────

interface OffProduct {
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
}

async function tryOFF(name: string, brand?: string | null): Promise<string | null> {
  await sleep(1000 + Math.random() * 500);
  const q = brand ? `${brand} ${name}`.slice(0, 80) : name.slice(0, 80);
  try {
    const { data } = await axios.get<{ products?: OffProduct[] }>(OFF_SEARCH, {
      params: { search_terms: q, countries_tags_en: 'turkey', page_size: 10, fields: 'product_name,brands,image_front_url,image_url' },
      timeout: 20_000,
      headers: { 'User-Agent': 'AkilliSepet/1.0', Accept: 'application/json' },
    });
    const target = normalizeName(name);
    let best: OffProduct | null = null;
    let bestScore = 0;
    for (const p of data.products ?? []) {
      if (!p.product_name) continue;
      const s = tokenScore(target, normalizeName(p.product_name));
      if (s > bestScore && (p.image_front_url || p.image_url)) { bestScore = s; best = p; }
    }
    if (best && bestScore >= 0.38) return best.image_front_url ?? best.image_url ?? null;
  } catch { /* ignore */ }
  return null;
}

// ─── DuckDuckGo görsel araması ────────────────────────────────────────────────

let ddgVqd: string | null = null;
let ddgVqdQuery = '';

async function getDdgVqd(q: string): Promise<string | null> {
  if (ddgVqd && ddgVqdQuery === q) return ddgVqd;
  await sleep(800);
  try {
    const { data } = await axios.post<string>(DDG_URL, new URLSearchParams({ q }), {
      timeout: 15_000,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html',
      },
      responseType: 'text',
    });
    const match = String(data).match(/vqd=['"]?([^'"&]+)/);
    if (match) { ddgVqd = match[1]; ddgVqdQuery = q; return ddgVqd; }
  } catch { /* ignore */ }
  return null;
}

async function tryDDG(name: string, brand?: string | null): Promise<string | null> {
  // Birden fazla sorgu varyantı dene
  const queries = [
    `${brand ?? ''} ${name} ürün fiyat`.trim(),
    `${brand ?? ''} ${stripUnits(name)}`.trim(),
    `${brand ?? ''} ${name}`.trim(),
  ].filter((q, i, a) => a.indexOf(q) === i).slice(0, 3);

  for (const q of queries.slice(0, 80 as unknown as number)) {
    const qTrimmed = q.slice(0, 80);
    const vqd = await getDdgVqd(qTrimmed);
    if (!vqd) continue;

    await sleep(500);
    try {
      const { data } = await axios.get<{ results?: { image?: string; title?: string; url?: string }[] }>(DDG_IMG, {
        params: { q: qTrimmed, vqd, f: ',,,,,', p: 1, o: 'json' },
        timeout: 15_000,
        headers: { 'User-Agent': UA, Referer: DDG_URL, Accept: 'application/json' },
      });

      const target = normalizeName(name);
      const brandNorm = brand ? normalizeName(brand) : null;
      let bestImg: string | null = null;
      let bestScore = 0;

      for (const r of data.results ?? []) {
        if (!r.image) continue;
        const titleNorm = normalizeName(r.title ?? '');
        let score = tokenScore(target, titleNorm);
        if (brandNorm && titleNorm.includes(brandNorm)) score += 0.1;
        // Ürün görseli siteleri: migros, trendyol, hepsiburada, n11 vb.
        const isProductSite = /migros|trendyol|hepsiburada|n11|getir|a101|bim\.com|sok\.com|koctas/i.test(r.url ?? '');
        if (isProductSite) score += 0.15;
        if (score > bestScore) { bestScore = score; bestImg = r.image; }
      }

      if (bestImg && bestScore >= 0.25) return bestImg;
      // Geniş fallback — herhangi bir görsel varsa al
      const first = data.results?.find((r) => r.image);
      if (first?.image) return first.image;
    } catch { /* ignore */ }
  }
  return null;
}

// ─── Ana döngü ────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry');
  const limitArg = process.argv.find((a) => a.startsWith('--limit'));
  const limit = limitArg
    ? parseInt(process.argv[process.argv.indexOf(limitArg) + 1] ?? limitArg.split('=')[1] ?? '50', 10)
    : undefined;

  const products = await prisma.product.findMany({
    where: { isActive: true, imageUrl: null },
    select: { id: true, name: true, brand: true, category: { select: { name: true } } },
    orderBy: { name: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Görselsiz ürün: ${products.length}${dryRun ? ' (dry-run)' : ''}`);

  const stats = { migros: 0, off: 0, ddg: 0, none: 0 };

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    process.stdout.write(`  [${i + 1}/${products.length}] ${prod.name.slice(0, 55).padEnd(55)} `);

    let imageUrl: string | null = null;
    let newBrand: string | undefined;
    let source = 'none';

    // 1) Migros
    const migros = await tryMigros(prod.name, prod.brand);
    if (migros?.imageUrl) {
      imageUrl = migros.imageUrl;
      newBrand = migros.brand;
      source = 'migros';
    }

    // 2) Open Food Facts
    if (!imageUrl) {
      const offImg = await tryOFF(prod.name, prod.brand ?? newBrand);
      if (offImg) { imageUrl = offImg; source = 'off'; }
    }

    // 3) DuckDuckGo
    if (!imageUrl) {
      const ddgImg = await tryDDG(prod.name, prod.brand ?? newBrand);
      if (ddgImg) { imageUrl = ddgImg; source = 'ddg'; }
    }

    process.stdout.write(source === 'none' ? '✗\n' : `✓ ${source}\n`);

    if (source === 'none') { stats.none++; continue; }
    if (source === 'migros') stats.migros++;
    else if (source === 'off') stats.off++;
    else stats.ddg++;

    if (!dryRun) {
      const patch: Record<string, unknown> = { imageUrl };
      if (newBrand && !prod.brand) patch.brand = newBrand;
      await prisma.product.update({ where: { id: prod.id }, data: patch });
    }
  }

  console.log('\nSonuç:');
  console.log(`  Migros: ${stats.migros} | OFF: ${stats.off} | DDG: ${stats.ddg} | Yok: ${stats.none}`);
  if (!dryRun) {
    const still = await prisma.product.count({ where: { isActive: true, imageUrl: null } });
    console.log(`  Hâlâ görselsiz: ${still}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
