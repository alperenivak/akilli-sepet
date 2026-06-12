// =====================================================
// Akıllı Sepet - Katman 2: Dummy Fiyat Seed
//
// Migros'taki her urun icin diger marketlerde gercekci
// fiyat tahmini uretir ve veritabanina yazar.
//
// Fiyat carp fyi (Migros baz alinir):
//   BİM         : %15-20 ucuz
//   A101        : %13-18 ucuz
//   ŞOK         : %14-19 ucuz
//   CarrefourSA : %0-5 pahali
//   Macrocenter : %2-8 pahali
//
// Her fiyat kucuk bir rastgele sapma (+/- %3) icerir.
// Kayitlar isSeedData=true, confidenceScore=0.2 ile isaretlenir.
//
// Calistirmak icin:
//   npm run seed:prices        — Migros bazli seed + eksik market doldurma
//   npm run seed:prices:gaps   — Sadece tek markette kalan urunler icin bosluk doldurma
// =====================================================

import { PrismaClient, PriceSource } from '@prisma/client';

const prisma = new PrismaClient();

// Market slug → fiyat carpani aralik tanimi
const MARKET_PRICE_FACTORS: Record<string, { min: number; max: number }> = {
  bim:         { min: 0.80, max: 0.85 }, // %15-20 ucuz
  a101:        { min: 0.82, max: 0.87 }, // %13-18 ucuz
  sok:         { min: 0.81, max: 0.86 }, // %14-19 ucuz
  carrefoursa: { min: 1.00, max: 1.05 }, // %0-5 pahali
  macrocenter: { min: 1.02, max: 1.08 }, // %2-8 pahali
};

// Seed verisi baslangic guven skoru (dusuk — gercek verinin gerisinde kalir)
const SEED_CONFIDENCE = 0.2;
// Ek rastgele sapma: +/- %3
const RANDOM_NOISE = 0.03;

function randomFactor(min: number, max: number): number {
  // Baz katsayi + kucuk rastgele gurultu
  const base = min + Math.random() * (max - min);
  const noise = (Math.random() * 2 - 1) * RANDOM_NOISE;
  return base + noise;
}

function roundToNearest5(amount: number): number {
  // Gercekci goruntum icin 5 kurusa yuvarla
  return Math.round(amount / 5) * 5;
}

/** Market carpani ortalamasi (Migros = 1.0 kabul) */
function marketMidFactor(slug: string): number {
  if (slug === 'migros') return 1.0;
  const f = MARKET_PRICE_FACTORS[slug];
  if (!f) return 1.0;
  return (f.min + f.max) / 2;
}

/** Herhangi bir market fiyatini Migros esdegerine cevirir */
function toMigrosEquivalent(amount: number, sourceSlug: string): number {
  return amount / marketMidFactor(sourceSlug);
}

/** Migros esdegerinden hedef market fiyatini uretir */
function fromMigrosEquivalent(migrosEq: number, targetSlug: string): number {
  if (targetSlug === 'migros') return migrosEq;
  const factor = MARKET_PRICE_FACTORS[targetSlug];
  if (!factor) return migrosEq;
  return migrosEq * randomFactor(factor.min, factor.max);
}

/** Seed fiyat kaydi olustur veya guncelle */
async function upsertSeedPrice(
  productId: string,
  marketId: string,
  seedAmount: number,
): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await prisma.price.findUnique({
    where: { productId_marketId: { productId, marketId } },
    select: { id: true, isSeedData: true },
  });

  if (existing && !existing.isSeedData) return 'skipped';

  if (existing?.isSeedData) {
    await prisma.price.update({
      where: { id: existing.id },
      data: {
        amount: seedAmount,
        source: PriceSource.MANUAL_ADMIN,
        isSeedData: true,
        confidenceScore: SEED_CONFIDENCE,
        needsVerification: false,
        lastUpdated: new Date(),
      },
    });
    return 'updated';
  }

  await prisma.price.create({
    data: {
      productId,
      marketId,
      amount: seedAmount,
      source: PriceSource.MANUAL_ADMIN,
      isSeedData: true,
      confidenceScore: SEED_CONFIDENCE,
      needsVerification: false,
      isAvailable: true,
    },
  });
  return 'created';
}

/**
 * Tek markette kalan veya eksik marketi olan urunler icin bosluk doldurma.
 * Mevcut fiyat(lar) referans alinir — sadece Migros degil, A101/scraper vb. de.
 */
async function fillMissingMarketPrices(allMarkets: Array<{ id: string; slug: string; name: string }>) {
  console.log('\n-----------------------------------------');
  console.log('Eksik market fiyatlari dolduruluyor...');
  console.log('-----------------------------------------');

  const productsWithPrices = await prisma.product.findMany({
    where: { isActive: true, prices: { some: { isAvailable: true } } },
    select: {
      id: true,
      name: true,
      prices: {
        where: { isAvailable: true },
        select: {
          marketId: true,
          amount: true,
          discountedAmount: true,
          isSeedData: true,
          market: { select: { slug: true } },
        },
      },
    },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let productsFixed = 0;

  for (const product of productsWithPrices) {
    const existingMarketIds = new Set(product.prices.map((p) => p.marketId));
    const missingMarkets = allMarkets.filter((m) => !existingMarketIds.has(m.id));
    if (missingMarkets.length === 0) continue;

    // Oncelik: gercek (non-seed) fiyatlar referans; yoksa mevcut herhangi biri
    const realRefs = product.prices.filter((p) => !p.isSeedData);
    const refs = realRefs.length > 0 ? realRefs : product.prices;
    const migrosEq =
      refs.reduce((sum, p) => {
        const amt = p.discountedAmount ?? p.amount;
        return sum + toMigrosEquivalent(amt, p.market.slug);
      }, 0) / refs.length;

    let fixedThisProduct = false;
    for (const market of missingMarkets) {
      const seedAmount = roundToNearest5(
        Math.round(fromMigrosEquivalent(migrosEq, market.slug)),
      );
      const result = await upsertSeedPrice(product.id, market.id, seedAmount);
      if (result === 'created') { created++; fixedThisProduct = true; }
      else if (result === 'updated') { updated++; fixedThisProduct = true; }
      else skipped++;
    }
    if (fixedThisProduct) productsFixed++;
  }

  console.log(`  Duzenlenen urun       : ${productsFixed}`);
  console.log(`  Yeni fiyat           : ${created}`);
  console.log(`  Guncellenen fiyat    : ${updated}`);
  console.log(`  Atlanan (gercek veri): ${skipped}`);

  return { created, updated, skipped, productsFixed };
}

async function main() {
  const gapsOnly = process.argv.includes('--gaps-only');

  console.log('');
  console.log('=========================================');
  if (gapsOnly) {
    console.log('Eksik market fiyatlari dolduruluyor (--gaps-only)...');
  } else {
    console.log('Katman 2: Dummy Fiyat Seed baslatiliyor...');
  }
  console.log('=========================================');

  const migros = await prisma.market.findUnique({ where: { slug: 'migros' } });
  if (!migros) {
    console.error('HATA: Migros marketi bulunamadi. Once seed.ts calistirin.');
    process.exit(1);
  }

  const targetMarkets = await prisma.market.findMany({
    where: {
      slug: { in: Object.keys(MARKET_PRICE_FACTORS) },
      isActive: true,
    },
    select: { id: true, slug: true, name: true },
  });

  const allMarkets = [
    { id: migros.id, slug: migros.slug, name: migros.name },
    ...targetMarkets,
  ];

  let totalCreated = 0;
  let totalSkipped = 0;
  let gapStats = { created: 0, updated: 0, skipped: 0, productsFixed: 0 };

  if (!gapsOnly) {
    if (targetMarkets.length === 0) {
      console.error('HATA: Hedef market bulunamadi.');
      process.exit(1);
    }
    console.log(`Hedef marketler: ${targetMarkets.map((m) => m.name).join(', ')}`);

    const migrosPrices = await prisma.price.findMany({
      where: { marketId: migros.id, isAvailable: true },
      select: { productId: true, amount: true, discountedAmount: true },
    });

    console.log(`Migros urun sayisi: ${migrosPrices.length}`);

    if (migrosPrices.length === 0) {
      console.error('HATA: Migros fiyati bulunamadi. Once Migros scraperini calistirin.');
      process.exit(1);
    }

    for (const market of targetMarkets) {
      const factor = MARKET_PRICE_FACTORS[market.slug];
      if (!factor) continue;

      console.log(`\n[${market.name}] isleniyor...`);

      let created = 0;
      let skipped = 0;
      const BATCH_SIZE = 50;

      for (let i = 0; i < migrosPrices.length; i += BATCH_SIZE) {
        const batch = migrosPrices.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (migrosPrice) => {
            const refAmount = migrosPrice.discountedAmount ?? migrosPrice.amount;
            const seedAmount = roundToNearest5(Math.round(refAmount * randomFactor(factor.min, factor.max)));
            const result = await upsertSeedPrice(migrosPrice.productId, market.id, seedAmount);
            if (result === 'created') created++;
            else if (result === 'updated') created++;
            else skipped++;
          }),
        );

        const progress = Math.min(i + BATCH_SIZE, migrosPrices.length);
        process.stdout.write(`\r  ${progress}/${migrosPrices.length} islendi...`);
      }

      console.log(`\n  [${market.name}] Tamamlandi: ${created} olusturuldu / ${skipped} atlandi`);
      totalCreated += created;
      totalSkipped += skipped;
    }
  }

  // Tek markette kalan / eksik marketi olan urunler icin bosluk doldur
  gapStats = await fillMissingMarketPrices(allMarkets);
  totalCreated += gapStats.created + gapStats.updated;

  // Ozet
  const totalPrices = await prisma.price.count({ where: { isAvailable: true } });
  const seedPrices = await prisma.price.count({ where: { isSeedData: true } });
  const singleMarketProducts = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::int as count FROM (
      SELECT p.id FROM products p
      JOIN prices pr ON pr."productId" = p.id AND pr."isAvailable" = true
      WHERE p."isActive" = true
      GROUP BY p.id
      HAVING COUNT(pr.id) = 1
    ) sub
  `;
  const monopolyCount = Number(singleMarketProducts[0]?.count ?? 0);

  console.log('');
  console.log('=========================================');
  console.log(gapsOnly ? 'Bosluk doldurma tamamlandi!' : 'Dummy fiyat seed tamamlandi!');
  console.log('');
  console.log(`Olusturulan/Guncellenen : ${totalCreated}`);
  console.log(`Atlanan (gercek veri)  : ${totalSkipped}`);
  console.log(`Bosluk doldurma        : ${gapStats.productsFixed} urun, ${gapStats.created} yeni fiyat`);
  console.log('');
  console.log('Veritabani ozeti:');
  console.log(`  Toplam aktif fiyat   : ${totalPrices}`);
  console.log(`  Seed (dummy) fiyat   : ${seedPrices}`);
  console.log(`  Gercek API/scraper   : ${totalPrices - seedPrices}`);
  console.log(`  Tek markette kalan   : ${monopolyCount} urun`);
  console.log('');
  console.log('Katman sistemi:');
  console.log('  Katman 1 - Migros API (confidenceScore=1.0) : Dogrulanmis');
  console.log('  Katman 2 - Seed data  (confidenceScore=0.2) : Henuz dogrulanmadi');
  console.log('  Katman 3 - Crowdsource (0.2-0.95)          : Kullanici bildirimi');
  console.log('=========================================');
}

main()
  .catch((e) => {
    console.error('Seed hatasi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
