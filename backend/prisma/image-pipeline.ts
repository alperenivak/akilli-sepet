/**
 * Görselsiz Ürün Görsel Bulma Pipeline'ı — v3
 *
 * Strateji (sırayla):
 *  1. Migros API  — HD görsel, birim, marka
 *  2. Open Food Facts (world) — barkod, global ürünler
 *  3. Trendyol Arama — Türk e-ticaret platformu, geniş ürün yelpazesi
 *  4. Gemini AI — akıllı arama sorgusu üretimi + Migros yeniden deneme
 *
 * Çalıştır: npx ts-node -r tsconfig-paths/register prisma/image-pipeline.ts
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { normalizeName } from './lib/product-enrichment';

const prisma = new PrismaClient();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const MIGROS_SEARCH = 'https://rest.migros.com.tr/sanalmarket/products/search';
const OFF_SEARCH = 'https://world.openfoodfacts.org/api/v2/search';
const TRENDYOL_SEARCH = 'https://apigw.trendyol.com/discovery-web-searchgw-service/api/search/v2';
const CACHE_FILE = path.join(__dirname, '.img-pipeline-cache.json');

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// Cache: ürün id → imageUrl
let cache: Record<string, string | null> = {};
if (fs.existsSync(CACHE_FILE)) {
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); } catch { /* ok */ }
}
function saveCache() { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); }

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

// ────────────────────────────────────────────────────────
// Kaynak 1: Migros API
// ────────────────────────────────────────────────────────
async function tryMigros(query: string, normTarget: string): Promise<string | null> {
  try {
    const { data } = await axios.get(MIGROS_SEARCH, {
      params: { q: query, page: 0, size: 20 },
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 10000,
    });
    const items: Array<{
      name?: string;
      images?: Array<{ urls?: Record<string, string> }>;
    }> = data?.data?.storeProductInfos ?? [];

    for (const item of items) {
      if (!item.name) continue;
      const score = tokenScore(normalizeName(item.name), normTarget);
      if (score >= 0.40) {
        const url = item.images?.[0]?.urls?.PRODUCT_HD
          ?? item.images?.[0]?.urls?.PRODUCT_DETAIL
          ?? item.images?.[0]?.urls?.PRODUCT_LIST;
        if (url) return url;
      }
    }
  } catch { /* hata loglama yok — sessizce devam */ }
  return null;
}

// ────────────────────────────────────────────────────────
// Kaynak 2: Open Food Facts (global)
// ────────────────────────────────────────────────────────
async function tryOpenFoodFacts(query: string, normTarget: string): Promise<string | null> {
  try {
    const { data } = await axios.get(OFF_SEARCH, {
      params: { search_terms: query, fields: 'product_name,image_front_url', page_size: 10 },
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 10000,
    });
    const products: Array<{ product_name?: string; image_front_url?: string }> = data?.products ?? [];
    for (const p of products) {
      if (!p.product_name || !p.image_front_url) continue;
      const score = tokenScore(normalizeName(p.product_name), normTarget);
      if (score >= 0.35) return p.image_front_url;
    }
  } catch { /* ok */ }
  return null;
}

// ────────────────────────────────────────────────────────
// Kaynak 3: Trendyol Arama
// ────────────────────────────────────────────────────────
async function tryTrendyol(query: string, normTarget: string): Promise<string | null> {
  try {
    const { data } = await axios.get(TRENDYOL_SEARCH, {
      params: {
        q: query,
        qt: query,
        st: query,
        os: 1,
        culture: 'tr-TR',
        userAreaCode: 'OM',
        channelId: 1,
        platform: 'web',
        isLegalRequirement: false,
        pId: '',
        scoringAlgorithmId: 2,
        searchStrategyType: 'DEFAULT',
        productStampType: 'TypeA',
        fixSlotProductAnchor: 0,
      },
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: 'https://www.trendyol.com/',
        Origin: 'https://www.trendyol.com',
        'x-forwarded-host': 'www.trendyol.com',
        'x-requested-with': 'XMLHttpRequest',
      },
      timeout: 12000,
    });

    const products: Array<{
      name?: string;
      images?: string[];
      image?: string;
    }> = data?.result?.products ?? data?.products ?? [];

    for (const p of products) {
      if (!p.name) continue;
      const score = tokenScore(normalizeName(p.name), normTarget);
      if (score >= 0.35) {
        const imageUrl = p.images?.[0] ?? p.image;
        if (imageUrl) {
          // Trendyol'da URL bazen protokolsüz gelir
          return imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
        }
      }
    }
  } catch { /* ok */ }
  return null;
}

// ────────────────────────────────────────────────────────
// Kaynak 4: Gemini AI — akıllı arama sorgusu + Migros yeniden deneme
// ────────────────────────────────────────────────────────
let gemini: InstanceType<typeof GoogleGenerativeAI> | null = null;

async function tryGeminiEnhanced(productName: string, brand: string | null, normTarget: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    if (!gemini) gemini = new GoogleGenerativeAI(apiKey);
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Bir Türk market uygulaması için ürün görseli arıyorum.
Ürün adı: "${productName}"${brand ? `\nMarka: "${brand}"` : ''}

Bu ürünü Migros veya başka bir Türk market sitesinde bulmak için en iyi 3 arama sorgusunu ver.
Sadece arama terimlerini listele, her biri yeni satırda, açıklama ekleme.
Türkçe ve kısa sorgular kullan (2-4 kelime).`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const queries = text.split('\n').map((q) => q.replace(/^\d+[\.\-\)]\s*/, '').trim()).filter(Boolean).slice(0, 3);

    for (const query of queries) {
      if (!query) continue;
      await sleep(500);
      const url = await tryMigros(query, normTarget);
      if (url) return url;
      await sleep(300);
      const tUrl = await tryTrendyol(query, normTarget);
      if (tUrl) return tUrl;
    }
  } catch { /* ok */ }
  return null;
}

// ────────────────────────────────────────────────────────
// Ana pipeline
// ────────────────────────────────────────────────────────
async function findImage(
  productId: string,
  productName: string,
  brand: string | null,
): Promise<string | null> {
  // Cache kontrolü
  if (productId in cache) return cache[productId];

  const normTarget = normalizeName(productName);
  const query = brand ? `${brand} ${productName}` : productName;

  // Sırayla kaynakları dene
  let url: string | null = null;

  // 1. Migros — tam sorgu
  url = await tryMigros(query, normTarget);
  if (url) { cache[productId] = url; return url; }
  await sleep(600);

  // 2. Migros — sadece isim
  url = await tryMigros(productName, normTarget);
  if (url) { cache[productId] = url; return url; }
  await sleep(400);

  // 3. Open Food Facts
  url = await tryOpenFoodFacts(query, normTarget);
  if (url) { cache[productId] = url; return url; }
  await sleep(300);

  // 4. Trendyol
  url = await tryTrendyol(query, normTarget);
  if (url) { cache[productId] = url; return url; }
  await sleep(400);

  // 5. Trendyol — sadece isim
  url = await tryTrendyol(productName, normTarget);
  if (url) { cache[productId] = url; return url; }
  await sleep(300);

  // 6. Gemini AI + Migros/Trendyol yeniden deneme
  url = await tryGeminiEnhanced(productName, brand, normTarget);
  if (url) { cache[productId] = url; return url; }

  cache[productId] = null;
  return null;
}

async function main() {
  console.log('=== GÖRSEL BULMA PİPELİNE — v3 ===\n');

  // Görseli olmayan aktif ürünler
  const products = await prisma.product.findMany({
    where: { isActive: true, imageUrl: null },
    select: { id: true, name: true, brand: true },
    orderBy: { name: 'asc' },
  });

  const geminiEnabled = Boolean(process.env.GEMINI_API_KEY);
  console.log(`Görselsiz ürün: ${products.length}`);
  console.log(`Gemini AI: ${geminiEnabled ? 'aktif' : 'devre dışı (GEMINI_API_KEY eksik)'}`);
  console.log(`Cache: ${Object.keys(cache).length} kayıt\n`);

  let found = 0;
  let notFound = 0;
  let batch = 0;

  for (const product of products) {
    // Cache'de varsa ve null değilse atla
    if (cache[product.id]) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: cache[product.id] },
      });
      found++;
      continue;
    }

    const imageUrl = await findImage(product.id, product.name, product.brand);

    if (imageUrl) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl },
      });
      found++;
      console.log(`  ✓ [${product.brand ?? '-'}] ${product.name.substring(0, 60)}`);
    } else {
      notFound++;
      if (notFound % 20 === 0) {
        console.log(`  ○ Bulunamayan: ${notFound} | Bulunan: ${found}`);
      }
    }

    batch++;
    if (batch % 10 === 0) {
      saveCache();
      console.log(`  → ${batch}/${products.length} işlendi (${found} bulundu, ${notFound} bulunamadı)`);
    }

    await sleep(200);
  }

  saveCache();

  console.log(`\n=== SONUÇ ===`);
  console.log(`  Görsel bulundu: ${found}`);
  console.log(`  Bulunamadı: ${notFound}`);
  console.log(`  Toplam işlenen: ${products.length}`);

  const remaining = await prisma.product.count({ where: { isActive: true, imageUrl: null } });
  const total = await prisma.product.count({ where: { isActive: true } });
  console.log(`\nGörselli ürün: ${total - remaining} / ${total}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  saveCache();
  prisma.$disconnect();
  process.exit(1);
});
