// =====================================================
// Ürün Zenginleştirme Seed — görseller + detaylar
// npm run seed:enrich-products
// npm run seed:enrich-products -- --refresh
// npm run seed:enrich-products -- --limit 50
// =====================================================

import { PrismaClient } from '@prisma/client';
import {
  enrichProduct,
  loadEnrichmentCache,
  loadEnrichmentCacheForce,
  saveEnrichmentCache,
  EnrichmentResult,
} from './lib/product-enrichment';

const prisma = new PrismaClient();

async function applyEnrichment(result: EnrichmentResult) {
  const data: Record<string, unknown> = {};
  if (result.imageUrl) data.imageUrl = result.imageUrl;
  if (result.brand) data.brand = result.brand;
  if (result.description) data.description = result.description;
  if (result.unit) data.unit = result.unit;
  if (result.unitValue != null) data.unitValue = result.unitValue;
  if (result.keywords?.length) data.keywords = result.keywords;

  if (Object.keys(data).length === 0) return false;

  await prisma.product.update({
    where: { id: result.productId },
    data,
  });

  if (result.barcode) {
    const existing = await prisma.barcode.findUnique({ where: { code: result.barcode } });
    if (!existing) {
      await prisma.barcode.create({
        data: {
          code: result.barcode,
          productId: result.productId,
        },
      });
    }
  }

  return true;
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  const limitArg = process.argv.find((a) => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] ?? process.argv[process.argv.indexOf('--limit') + 1], 10) : undefined;
  const missingOnly = !process.argv.includes('--all');

  console.log('Ürün zenginleştirme başlıyor…');

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(missingOnly ? { OR: [{ imageUrl: null }, { description: null }, { unit: null }] } : {}),
    },
    select: {
      id: true,
      name: true,
      brand: true,
      imageUrl: true,
      category: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`İşlenecek ürün: ${products.length}${missingOnly ? ' (eksik alanlı)' : ''}`);

  let cache = refresh ? null : (loadEnrichmentCache() ?? loadEnrichmentCacheForce());
  const results: EnrichmentResult[] = cache ? Object.values(cache) : [];
  const cacheMap = new Map(results.map((r) => [r.productId, r]));

  const stats = { migros: 0, openfoodfacts: 0, parsed: 0, none: 0, skipped: 0, updated: 0 };

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    let result = cacheMap.get(p.id);

    if (!result || refresh) {
      process.stdout.write(`  [${i + 1}/${products.length}] ${p.name.slice(0, 50)}… `);
      result = await enrichProduct({
        id: p.id,
        name: p.name,
        brand: p.brand,
        categoryName: p.category?.name,
      });
      cacheMap.set(p.id, result);
      console.log(result.source + (result.imageUrl ? ' ✓' : ''));
    } else {
      stats.skipped++;
    }

    stats[result.source]++;
    const ok = await applyEnrichment(result);
    if (ok) stats.updated++;
  }

  if (!refresh || products.length > 0) {
    saveEnrichmentCache([...cacheMap.values()]);
    console.log(`Önbellek kaydedildi (${cacheMap.size} ürün).`);
  }

  console.log('\nÖzet:');
  console.log(`  Güncellenen: ${stats.updated}`);
  console.log(`  Migros: ${stats.migros} | Open Food Facts: ${stats.openfoodfacts} | Parse: ${stats.parsed} | Yok: ${stats.none}`);
  if (stats.skipped) console.log(`  Önbellekten atlanan: ${stats.skipped}`);

  const withImg = await prisma.product.count({ where: { isActive: true, NOT: { imageUrl: null } } });
  const withDesc = await prisma.product.count({ where: { isActive: true, NOT: { description: null } } });
  console.log(`\nDB: ${withImg} görsel, ${withDesc} açıklama (aktif ürünler)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
