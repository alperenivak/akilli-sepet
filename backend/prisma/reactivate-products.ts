/**
 * Hatalı şekilde pasife alınan ürünleri yeniden aktive eder.
 * isActive=false, stok bitti anlamına gelir — görselsiz ürün pasif yapılmamalıydı.
 *
 * Çalıştır: npx ts-node -r tsconfig-paths/register prisma/reactivate-products.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== ÜRÜN YENİDEN AKTİVASYON ===\n');

  const beforeActive = await prisma.product.count({ where: { isActive: true } });
  const beforeInactive = await prisma.product.count({ where: { isActive: false } });

  console.log(`Mevcut durum:`);
  console.log(`  Aktif: ${beforeActive}`);
  console.log(`  Pasif: ${beforeInactive}`);

  // İnaktif ürünlerin örneği
  const sample = await prisma.product.findMany({
    where: { isActive: false },
    select: { name: true, brand: true, imageUrl: true },
    take: 20,
    orderBy: { name: 'asc' },
  });

  console.log('\nPasif ürün örnekleri:');
  sample.forEach((p) => {
    const hasImg = p.imageUrl ? '✓' : '✗';
    console.log(`  [img:${hasImg}] [${p.brand ?? '-'}] ${p.name}`);
  });

  // Tümünü aktive et (stok ile ilgisi olmayan pasifleştirme geri alınıyor)
  const result = await prisma.product.updateMany({
    where: { isActive: false },
    data: { isActive: true },
  });

  const afterActive = await prisma.product.count({ where: { isActive: true } });

  console.log(`\n✅ ${result.count} ürün yeniden aktive edildi`);
  console.log(`   Toplam aktif ürün: ${afterActive}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
