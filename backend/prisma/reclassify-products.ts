/**
 * Tüm ürünlerin kategori atamasını yeniden yapar.
 * Ürün adı + marka bilgisini kullanarak doğru kategoriyi belirler.
 * Yanlış kategorideki ürünleri (Bref'in Gıda'da olması gibi) düzeltir.
 *
 * Çalıştır: npx ts-node -r tsconfig-paths/register prisma/reclassify-products.ts
 */

import { PrismaClient } from '@prisma/client';
import { mapProductToCategory } from '../src/modules/scraper/utils/category-mapper';

const prisma = new PrismaClient();

async function main() {
  console.log('=== ÜRÜN YENİDEN SINIFLANDIRMA ===\n');

  // Tüm kategorileri yükle (slug → id eşlemesi)
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, parentId: true },
  });

  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  function getIdBySlug(slug: string | null): string | null {
    if (!slug) return null;
    return catBySlug.get(slug)?.id ?? null;
  }

  // Gıda kategori id'sini bul (yanlış atamaların çoğunun bulunduğu yer)
  const gidaCat = catBySlug.get('gida');
  if (!gidaCat) {
    console.error('Gıda kategorisi bulunamadı');
    process.exit(1);
  }

  // Tüm aktif ürünleri yükle
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      brand: true,
      categoryId: true,
      category: { select: { slug: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Toplam aktif ürün: ${products.length}`);

  let reclassified = 0;
  let alreadyCorrect = 0;
  let undetermined = 0;

  const updates: Array<{ id: string; from: string; to: string; name: string }> = [];

  for (const product of products) {
    const mappedSlug = mapProductToCategory(product.name, product.brand);
    const mappedId = getIdBySlug(mappedSlug);

    if (!mappedSlug || !mappedId) {
      // Kategori belirlenemedi — dokunma
      undetermined++;
      continue;
    }

    if (mappedId === product.categoryId) {
      alreadyCorrect++;
      continue;
    }

    const toCategory = catBySlug.get(mappedSlug);
    updates.push({
      id: product.id,
      from: product.category?.name ?? product.categoryId,
      to: toCategory?.name ?? mappedSlug,
      name: product.name,
    });
  }

  console.log(`\nGüncellenecek: ${updates.length}`);
  console.log(`Zaten doğru: ${alreadyCorrect}`);
  console.log(`Belirlenemedi: ${undetermined}`);

  if (updates.length === 0) {
    console.log('\nGüncellenecek ürün yok.');
    await prisma.$disconnect();
    return;
  }

  // İlk 50 güncellemeyi göster
  console.log('\n=== ÖNİZLEME (ilk 50) ===');
  updates.slice(0, 50).forEach((u) => {
    console.log(`  [${u.from.padEnd(25)} → ${u.to.padEnd(25)}] ${u.name.substring(0, 60)}`);
  });

  if (updates.length > 50) {
    console.log(`  ... ve ${updates.length - 50} ürün daha`);
  }

  // Toplu güncelleme: kategori bazında grupla
  const byCategory = new Map<string, string[]>();
  for (const u of updates) {
    const mappedSlug = mapProductToCategory(
      products.find((p) => p.id === u.id)!.name,
      products.find((p) => p.id === u.id)!.brand,
    )!;
    const catId = getIdBySlug(mappedSlug)!;
    if (!byCategory.has(catId)) byCategory.set(catId, []);
    byCategory.get(catId)!.push(u.id);
  }

  console.log('\n=== KATEGORİ BAZLI GÜNCELLEME ===');
  for (const [catId, ids] of byCategory) {
    const cat = categories.find((c) => c.id === catId);
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { categoryId: catId },
    });
    console.log(`  ${(cat?.name ?? catId).padEnd(25)} ← ${result.count} ürün güncellendi`);
    reclassified += result.count;
  }

  console.log(`\n✅ Toplam ${reclassified} ürün yeniden sınıflandırıldı`);

  // Sonuç dağılımı
  console.log('\n=== GÜNCEL KATEGORİ DAĞILIMI ===');
  const counts = await prisma.product.groupBy({
    by: ['categoryId'],
    where: { isActive: true },
    _count: true,
    orderBy: { _count: { categoryId: 'desc' } },
  });

  for (const row of counts) {
    const cat = categories.find((c) => c.id === row.categoryId);
    console.log(`  ${(cat?.name ?? '?').padEnd(28)} ${row._count}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
