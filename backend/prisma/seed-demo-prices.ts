// =====================================================
// Demo Fiyat Kontrolcüsü & Seed — Sepet Optimizasyonu Demo
//
// Amaç: Sunumda sepet optimizasyonu çalışabilmesi için
//       3-5 ürünün birden fazla markette fiyatı olduğunu doğrular.
//       Eksikse demo fiyat verisi ekler.
//
// SADECE isSeedData=true kayıtlar eklenir — gerçek verilerle çakışmaz.
//
// Yerel:
//   npm run seed:demo:prices
//
// Railway:
//   railway run npm run seed:demo:prices
// =====================================================

import { PrismaClient, PriceSource } from '@prisma/client';

const prisma = new PrismaClient();

// Sepet demo için gereken minimum şart:
// Bu kadar ürün, bu kadar farklı markette fiyat kaydına sahip olmalı
const MIN_PRODUCTS_WITH_MULTI_MARKET = 3;
const MIN_MARKETS_PER_PRODUCT = 3;

// Demo fiyat verisi (TL cinsinden, kuruşa çevrilecek)
// productNameSearch: partial match, marketSlug: tam slug
const DEMO_PRICES: Array<{
  productNameSearch: string;
  prices: Array<{ marketSlug: string; amountTL: number; discountedTL?: number }>;
}> = [
  {
    productNameSearch: 'süt',
    prices: [
      { marketSlug: 'migros',     amountTL: 29.90 },
      { marketSlug: 'a101',       amountTL: 27.50, discountedTL: 24.90 },
      { marketSlug: 'bim',        amountTL: 26.90 },
      { marketSlug: 'sok',        amountTL: 28.50 },
      { marketSlug: 'carrefoursa',amountTL: 30.50, discountedTL: 28.00 },
    ],
  },
  {
    productNameSearch: 'yumurta',
    prices: [
      { marketSlug: 'migros',     amountTL: 74.90, discountedTL: 69.90 },
      { marketSlug: 'a101',       amountTL: 69.90 },
      { marketSlug: 'bim',        amountTL: 67.50 },
      { marketSlug: 'sok',        amountTL: 71.00 },
      { marketSlug: 'carrefoursa',amountTL: 76.90 },
    ],
  },
  {
    productNameSearch: 'ayçiçek yağı',
    prices: [
      { marketSlug: 'migros',     amountTL: 89.90 },
      { marketSlug: 'a101',       amountTL: 84.90, discountedTL: 79.90 },
      { marketSlug: 'bim',        amountTL: 82.50 },
      { marketSlug: 'sok',        amountTL: 86.00 },
      { marketSlug: 'carrefoursa',amountTL: 91.50, discountedTL: 87.00 },
    ],
  },
  {
    productNameSearch: 'peynir',
    prices: [
      { marketSlug: 'migros',     amountTL: 149.90 },
      { marketSlug: 'a101',       amountTL: 139.90 },
      { marketSlug: 'bim',        amountTL: 134.90 },
      { marketSlug: 'carrefoursa',amountTL: 154.90, discountedTL: 144.90 },
    ],
  },
  {
    productNameSearch: 'makarna',
    prices: [
      { marketSlug: 'migros',     amountTL: 34.90 },
      { marketSlug: 'a101',       amountTL: 31.90 },
      { marketSlug: 'bim',        amountTL: 29.90 },
      { marketSlug: 'sok',        amountTL: 32.50 },
      { marketSlug: 'carrefoursa',amountTL: 35.90 },
    ],
  },
];

async function findProduct(nameSearch: string): Promise<{ id: string; name: string } | null> {
  const keywords = nameSearch.toLowerCase().split(' ');
  for (const kw of keywords) {
    const product = await prisma.product.findFirst({
      where: { name: { contains: kw, mode: 'insensitive' }, isActive: true },
      select: { id: true, name: true },
    });
    if (product) return product;
  }
  return null;
}

async function main() {
  console.log('\n=== Demo Fiyat Kontrolü & Seed ===\n');

  // ── 1. Mevcut durumu kontrol et ───────────────────
  const markets = await prisma.market.findMany({ select: { id: true, slug: true } });
  const marketMap = new Map(markets.map((m) => [m.slug, m.id]));

  if (markets.length === 0) {
    console.error('❌ HATA: Hiç market yok! Önce market verisini import edin.');
    process.exit(1);
  }

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    console.error('❌ HATA: Hiç ürün yok! Önce ürün verisini import edin.');
    process.exit(1);
  }

  // Kaç ürünün 3+ markette fiyatı var?
  const multiMarketGroups = await prisma.price.groupBy({
    by: ['productId'],
    _count: { marketId: true },
    having: { marketId: { _count: { gte: MIN_MARKETS_PER_PRODUCT } } },
  });

  console.log(`📊 Mevcut durum:`);
  console.log(`   ${productCount} ürün var`);
  console.log(`   ${markets.length} market var`);
  console.log(`   ${multiMarketGroups.length} ürünün ${MIN_MARKETS_PER_PRODUCT}+ markette fiyatı var\n`);

  if (multiMarketGroups.length >= MIN_PRODUCTS_WITH_MULTI_MARKET) {
    console.log(
      `✅ Demo sepet koşulu SAĞLANIYOR!\n`
      + `   ${multiMarketGroups.length} ürün ${MIN_MARKETS_PER_PRODUCT}+ markette fiyat kaydına sahip.\n`
      + `   Sepet optimizasyonu demo için hazır.\n`,
    );

    // En iyi 5 demo ürünü göster
    const top5 = multiMarketGroups.slice(0, 5);
    const topProducts = await prisma.product.findMany({
      where: { id: { in: top5.map((g) => g.productId) } },
      select: { id: true, name: true },
    });
    console.log('Demo için önerilen ürünler:');
    for (const g of top5) {
      const prod = topProducts.find((p) => p.id === g.productId);
      if (prod) {
        console.log(`   ${prod.name.substring(0, 50).padEnd(50)} — ${g._count.marketId} market`);
      }
    }
    console.log();
    return;
  }

  // ── 2. Yeterli veri yok, demo seed ekle ──────────
  console.log(
    `⚠ Demo koşulu sağlanmıyor (${multiMarketGroups.length}/${MIN_PRODUCTS_WITH_MULTI_MARKET}).\n`
    + `  Demo fiyat verisi ekleniyor...\n`,
  );

  let addedPrices = 0;
  let skippedPrices = 0;
  let productNotFound = 0;

  for (const demoEntry of DEMO_PRICES) {
    const product = await findProduct(demoEntry.productNameSearch);
    if (!product) {
      console.warn(`  ⚠ Ürün bulunamadı: "${demoEntry.productNameSearch}"`);
      productNotFound++;
      continue;
    }

    console.log(`  🛒 ${product.name.substring(0, 50)}`);

    for (const priceEntry of demoEntry.prices) {
      const marketId = marketMap.get(priceEntry.marketSlug);
      if (!marketId) {
        console.warn(`     ⚠ Market bulunamadı: ${priceEntry.marketSlug}`);
        continue;
      }

      const existing = await prisma.price.findUnique({
        where: { productId_marketId: { productId: product.id, marketId } },
      });

      if (existing) {
        console.log(`     ↩ Zaten var: ${priceEntry.marketSlug} (${(existing.amount / 100).toFixed(2)} TL)`);
        skippedPrices++;
        continue;
      }

      await prisma.price.create({
        data: {
          productId:       product.id,
          marketId,
          amount:          Math.round(priceEntry.amountTL * 100),
          discountedAmount: priceEntry.discountedTL
            ? Math.round(priceEntry.discountedTL * 100)
            : null,
          isAvailable:     true,
          isSeedData:      true,
          source:          PriceSource.MANUAL_ADMIN,
          confidenceScore: 0.7,
        },
      });

      console.log(`     ✅ ${priceEntry.marketSlug.padEnd(14)} ${priceEntry.amountTL.toFixed(2)} TL`);
      addedPrices++;
    }
  }

  // ── 3. Son durum kontrolü ─────────────────────────
  const afterGroups = await prisma.price.groupBy({
    by: ['productId'],
    _count: { marketId: true },
    having: { marketId: { _count: { gte: MIN_MARKETS_PER_PRODUCT } } },
  });

  console.log(`\n✅ Sonuç: ${addedPrices} fiyat eklendi, ${skippedPrices} zaten vardı`);
  console.log(`   ${afterGroups.length} ürünün ${MIN_MARKETS_PER_PRODUCT}+ markette fiyatı var\n`);

  if (afterGroups.length >= MIN_PRODUCTS_WITH_MULTI_MARKET) {
    console.log('✅ Demo sepet koşulu artık SAĞLANIYOR! Sepet optimizasyonu hazır.\n');
  } else {
    console.error('❌ Hâlâ yeterli çok-marketli ürün yok. Ürün verisini kontrol edin.');
    if (productNotFound > 0) {
      console.error(
        `   ${productNotFound} ürün bulunamadı. DEMO_PRICES listesindeki\n`
        + `   "productNameSearch" değerlerini veritabanınızdaki ürün adlarıyla güncelleyin.`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Hata:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
