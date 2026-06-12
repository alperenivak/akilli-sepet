// =====================================================
// Ürün zenginleştirme — Migros API + Open Food Facts
// Görseller, birim, açıklama, barkod
// =====================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const MIGROS_SEARCH = 'https://rest.migros.com.tr/sanalmarket/products/search';
const OFF_SEARCH = 'https://world.openfoodfacts.org/api/v2/search';
const CACHE_PATH = path.join(__dirname, '..', 'data', 'product-enrichment-cache.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36 AkilliSepet/1.0';
const MIGROS_DELAY_MS = 900;
const OFF_DELAY_MS = 1200;
const MAX_RETRIES = 3;

export interface EnrichmentInput {
  id: string;
  name: string;
  brand?: string | null;
  categoryName?: string | null;
}

export interface EnrichmentResult {
  productId: string;
  imageUrl?: string;
  brand?: string;
  description?: string;
  unit?: string;
  unitValue?: number;
  barcode?: string;
  keywords?: string[];
  source: 'migros' | 'openfoodfacts' | 'parsed' | 'none';
}

interface MigrosSearchItem {
  sku?: string;
  name?: string;
  brand?: { name?: string };
  category?: { name?: string };
  categoryAscendants?: { name?: string }[];
  images?: { urls?: Record<string, string> }[];
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  quantity?: string;
  product_quantity?: string | number;
  product_quantity_unit?: string;
  generic_name?: string;
  ingredients_text_tr?: string;
  ingredients_text?: string;
  categories?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function normalizeName(raw: string): string {
  let n = raw.trim().toLowerCase();
  n = n.replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u');
  n = n.replace(/(\d),(\d)/g, '$1.$2');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:litre|liter|lt|l)\b/g, '$1l');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:kilogram|kilo|kg)\b/g, '$1kg');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:mililitre|millilitre|ml)\b/g, '$1ml');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:gram|grams|gr|g)\b/g, '$1g');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:adet|adt)\b/g, '$1ad');
  n = n.replace(/(\d)\.(\d)/g, '$1$2');
  n = n.replace(/[^a-z0-9\s]/g, ' ');
  return n.replace(/\s+/g, ' ').trim();
}

export function parseUnitFromName(name: string): { unit: string; unitValue: number } | null {
  const multi = name.match(/(\d+)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(ml|g|gr|gram|lt|l|litre)/i);
  if (multi) {
    const count = parseInt(multi[1], 10);
    const val = parseFloat(multi[2].replace(',', '.'));
    const u = multi[3].toLowerCase();
    if (u.startsWith('l')) return { unit: 'ml', unitValue: count * val * 1000 };
    if (u.startsWith('g')) return { unit: 'g', unitValue: count * val };
    return { unit: 'ml', unitValue: count * val };
  }

  const patterns: [RegExp, string][] = [
    [/(\d+(?:[.,]\d+)?)\s*(?:litre|liter|lt|l)\b/i, 'litre'],
    [/(\d+(?:[.,]\d+)?)\s*(?:kilogram|kilo|kg)\b/i, 'kg'],
    [/(\d+(?:[.,]\d+)?)\s*(?:mililitre|millilitre|ml)\b/i, 'ml'],
    [/(\d+(?:[.,]\d+)?)\s*(?:gram|grams|gr|g)\b/i, 'g'],
    [/(\d+(?:[.,]\d+)?)\s*(?:adet|adt|li)\b/i, 'adet'],
    [/(\d+(?:[.,]\d+)?)\s*cl\b/i, 'ml'],
  ];

  for (const [re, unit] of patterns) {
    const m = name.match(re);
    if (!m) continue;
    let val = parseFloat(m[1].replace(',', '.'));
    if (unit === 'ml' && re.source.includes('cl')) val *= 10;
    return { unit, unitValue: val };
  }
  return null;
}

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

function migrosImage(item: MigrosSearchItem): string | undefined {
  const urls = item.images?.[0]?.urls;
  if (!urls) return undefined;
  return urls.PRODUCT_HD ?? urls.PRODUCT_DETAIL ?? urls.PRODUCT_LIST;
}

function categoryPath(item: MigrosSearchItem): string | undefined {
  const asc = item.categoryAscendants?.map((c) => c.name).filter(Boolean) ?? [];
  const leaf = item.category?.name;
  const parts = [...asc];
  if (leaf && !parts.includes(leaf)) parts.push(leaf);
  return parts.length ? parts.join(' › ') : undefined;
}

function buildDescription(opts: {
  name: string;
  brand?: string;
  categoryPath?: string;
  categoryName?: string;
  extra?: string;
}): string {
  const lines: string[] = [];
  if (opts.brand) {
    lines.push(`${opts.brand} markasına ait ${opts.name}.`);
  } else {
    lines.push(`${opts.name} — market raf ürünü.`);
  }
  const cat = opts.categoryPath ?? opts.categoryName;
  if (cat) lines.push(`Kategori: ${cat}.`);
  if (opts.extra) {
    const trimmed = opts.extra.replace(/\s+/g, ' ').trim();
    if (trimmed.length > 20) {
      lines.push(trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed);
    }
  }
  return lines.join(' ');
}

function buildKeywords(name: string, brand?: string, categoryName?: string): string[] {
  const raw = [brand, categoryName, ...name.split(/\s+/)]
    .filter(Boolean)
    .map((s) => s!.toLowerCase())
    .filter((s) => s.length > 2);
  return [...new Set(raw)].slice(0, 12);
}

function parseOffUnit(p: OffProduct): { unit?: string; unitValue?: number } | null {
  if (p.product_quantity && p.product_quantity_unit) {
    const val = parseFloat(String(p.product_quantity).replace(',', '.'));
    let unit = p.product_quantity_unit.toLowerCase();
    if (unit === 'l') unit = 'litre';
    if (!Number.isNaN(val) && val > 0) return { unit, unitValue: val };
  }
  if (p.quantity) return parseUnitFromName(p.quantity);
  return null;
}

async function axiosGet<T>(url: string, params?: Record<string, string | number>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get<T>(url, {
        params,
        timeout: 20_000,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Accept-Language': 'tr-TR,tr;q=0.9',
          Referer: 'https://www.migros.com.tr/',
        },
      });
      return data;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (attempt < MAX_RETRIES - 1 && (status === 429 || status === 503 || status === 504)) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error('axiosGet failed');
}

async function searchMigros(query: string): Promise<MigrosSearchItem[]> {
  await sleep(MIGROS_DELAY_MS);
  const data = await axiosGet<{ data?: { storeProductInfos?: MigrosSearchItem[] } }>(
    MIGROS_SEARCH,
    { q: query, page: 0, size: 8 },
  );
  return data.data?.storeProductInfos ?? [];
}

function pickMigrosMatch(input: EnrichmentInput, items: MigrosSearchItem[]): MigrosSearchItem | null {
  if (!items.length) return null;
  const target = normalizeName(input.name);
  const brandNorm = input.brand ? normalizeName(input.brand) : null;

  let best: MigrosSearchItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    if (!item.name) continue;
    const cand = normalizeName(item.name);
    if (cand === target) return item;

    let score = tokenScore(target, cand);
    const itemBrand = item.brand?.name ? normalizeName(item.brand.name) : null;
    if (brandNorm && itemBrand) {
      if (brandNorm === itemBrand) score += 0.15;
      else if (!cand.includes(brandNorm)) score -= 0.2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 0.55 ? best : null;
}

async function enrichFromMigros(input: EnrichmentInput): Promise<Partial<EnrichmentResult> | null> {
  const queries = [
    input.name,
    input.brand ? `${input.brand} ${input.name}` : null,
  ].filter(Boolean) as string[];

  for (const q of queries) {
    try {
      const items = await searchMigros(q);
      const match = pickMigrosMatch(input, items);
      if (!match) continue;

      const imageUrl = migrosImage(match);
      const parsed = parseUnitFromName(match.name ?? input.name);
      const brand = match.brand?.name?.trim() ?? input.brand ?? undefined;
      const catPath = categoryPath(match);

      return {
        imageUrl,
        brand,
        unit: parsed?.unit,
        unitValue: parsed?.unitValue,
        description: buildDescription({
          name: match.name ?? input.name,
          brand,
          categoryPath: catPath,
          categoryName: input.categoryName ?? undefined,
        }),
        keywords: buildKeywords(input.name, brand, catPath ?? input.categoryName ?? undefined),
        source: 'migros',
      };
    } catch {
      // sonraki sorgu
    }
  }
  return null;
}

async function searchOpenFoodFacts(input: EnrichmentInput): Promise<OffProduct | null> {
  await sleep(OFF_DELAY_MS);
  const searchTerms = input.brand
    ? `${input.brand} ${input.name}`.slice(0, 80)
    : input.name.slice(0, 80);

  const data = await axiosGet<{ products?: OffProduct[] }>(OFF_SEARCH, {
    search_terms: searchTerms,
    countries_tags_en: 'turkey',
    page_size: 8,
    fields: [
      'code', 'product_name', 'brands', 'image_front_url', 'image_url',
      'quantity', 'product_quantity', 'product_quantity_unit',
      'generic_name', 'ingredients_text_tr', 'ingredients_text', 'categories',
    ].join(','),
  });

  const target = normalizeName(input.name);
  const brandNorm = input.brand ? normalizeName(input.brand) : null;

  let best: OffProduct | null = null;
  let bestScore = 0;

  for (const p of data.products ?? []) {
    if (!p.product_name) continue;
    const cand = normalizeName(p.product_name);
    let score = tokenScore(target, cand);
    if (brandNorm && p.brands) {
      const offBrand = normalizeName(p.brands.split(',')[0]);
      if (offBrand.includes(brandNorm) || brandNorm.includes(offBrand)) score += 0.12;
    }
    if (!p.image_front_url && !p.image_url) score -= 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  return bestScore >= 0.45 ? best : null;
}

async function enrichFromOpenFoodFacts(input: EnrichmentInput): Promise<Partial<EnrichmentResult> | null> {
  try {
    const match = await searchOpenFoodFacts(input);
    if (!match) return null;

    const imageUrl = match.image_front_url ?? match.image_url;
    const brand = match.brands?.split(',')[0]?.trim() ?? input.brand ?? undefined;
    const parsedOff = parseOffUnit(match);
    const parsedName = parseUnitFromName(input.name);
    const parsed = parsedOff ?? parsedName ?? undefined;
    const extra = match.ingredients_text_tr ?? match.ingredients_text ?? match.generic_name;

    return {
      imageUrl,
      brand,
      barcode: match.code?.match(/^\d{8,14}$/) ? match.code : undefined,
      unit: parsed?.unit,
      unitValue: parsed?.unitValue,
      description: buildDescription({
        name: input.name,
        brand,
        categoryName: match.categories?.split(',').pop()?.trim() ?? input.categoryName ?? undefined,
        extra,
      }),
      keywords: buildKeywords(input.name, brand, input.categoryName ?? undefined),
      source: 'openfoodfacts',
    };
  } catch {
    return null;
  }
}

export async function enrichProduct(input: EnrichmentInput): Promise<EnrichmentResult> {
  const migros = await enrichFromMigros(input);
  if (migros?.imageUrl) {
    return { productId: input.id, ...migros, source: 'migros' };
  }

  const off = await enrichFromOpenFoodFacts(input);
  if (off?.imageUrl) {
    return { productId: input.id, ...off, source: 'openfoodfacts' };
  }

  const parsedUnit = parseUnitFromName(input.name);
  const merged = { ...off, ...migros };
  const description = merged.description ?? buildDescription({
    name: input.name,
    brand: merged.brand ?? input.brand ?? undefined,
    categoryName: input.categoryName ?? undefined,
  });

  return {
    productId: input.id,
    imageUrl: merged.imageUrl,
    brand: merged.brand ?? input.brand ?? undefined,
    description,
    unit: merged.unit ?? parsedUnit?.unit,
    unitValue: merged.unitValue ?? parsedUnit?.unitValue,
    barcode: merged.barcode,
    keywords: merged.keywords ?? buildKeywords(input.name, input.brand ?? undefined, input.categoryName ?? undefined),
    source: merged.source ?? (parsedUnit ? 'parsed' : 'none'),
  };
}

export function loadEnrichmentCache(): Record<string, EnrichmentResult> | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as { cachedAt?: string; items?: EnrichmentResult[] };
    if (!raw.items?.length) return null;
    const age = Date.now() - new Date(raw.cachedAt ?? 0).getTime();
    if (age > 30 * 24 * 60 * 60 * 1000) return null;
    return Object.fromEntries(raw.items.map((i) => [i.productId, i]));
  } catch {
    return null;
  }
}

export function saveEnrichmentCache(items: EnrichmentResult[]) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ cachedAt: new Date().toISOString(), items }, null, 0));
}

export function loadEnrichmentCacheForce(): Record<string, EnrichmentResult> | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as { items?: EnrichmentResult[] };
    if (!raw.items?.length) return null;
    return Object.fromEntries(raw.items.map((i) => [i.productId, i]));
  } catch {
    return null;
  }
}

export function enrichmentFromMigrosItem(item: MigrosSearchItem, fallbackName: string): Partial<EnrichmentResult> {
  const imageUrl = migrosImage(item);
  const parsed = parseUnitFromName(item.name ?? fallbackName);
  const brand = item.brand?.name?.trim();
  const catPath = categoryPath(item);
  return {
    imageUrl,
    brand,
    unit: parsed?.unit,
    unitValue: parsed?.unitValue,
    description: buildDescription({
      name: item.name ?? fallbackName,
      brand,
      categoryPath: catPath,
    }),
    keywords: buildKeywords(fallbackName, brand, catPath),
    source: 'migros',
  };
}
