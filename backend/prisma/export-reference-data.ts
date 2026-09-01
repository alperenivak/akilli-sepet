// =====================================================
// Referans Veri Export — Local PostgreSQL → JSON
//
// Kullanım:
//   # Sadece sayıları göster:
//   npm run db:export -- --count
//
//   # Export et (local .env'den):
//   npm run db:export
//
//   # Farklı kaynak ile:
//   SOURCE_DATABASE_URL="postgresql://..." npm run db:export
// =====================================================

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const SOURCE_URL =
  process.env.SOURCE_DATABASE_URL ??
  process.env.DATABASE_URL;

if (!SOURCE_URL) {
  console.error('HATA: SOURCE_DATABASE_URL veya DATABASE_URL env değişkeni gerekli.');
  process.exit(1);
}

const src = new PrismaClient({
  datasources: { db: { url: SOURCE_URL } },
  log: [],
});

const EXPORT_DIR = path.join(__dirname, 'data', 'export');

// ── Yardımcı fonksiyonlar ───────────────────────────

function maskUrl(url: string) {
  return url.replace(/:\/\/[^@]+@/, '://***@');
}

function save(name: string, rows: object[]) {
  const file = path.join(EXPORT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`  ✓ ${name.padEnd(26)} ${String(rows.length).padStart(7)} kayıt`);
}

// ── Sayım modu ──────────────────────────────────────

async function countOnly() {
  console.log('\n=== Local DB — Referans Tablo Kayıt Sayıları ===\n');

  const tables: [string, () => Promise<number>][] = [
    ['categories',          () => src.category.count()],
    ['markets',             () => src.market.count()],
    ['market_branches',     () => src.marketBranch.count()],
    ['products',            () => src.product.count()],
    ['barcodes',            () => src.barcode.count()],
    ['community_rewards',   () => src.communityReward.count()],
    ['reward_coupon_codes', () => src.rewardCouponCode.count()],
    ['prices',              () => src.price.count()],
    ['price_history',       () => src.priceHistory.count()],
    ['catalogs',            () => src.catalog.count()],
    ['catalog_pages',       () => src.catalogPage.count()],
  ];

  let total = 0;
  for (const [label, fn] of tables) {
    const n = await fn();
    total += n;
    const flag = n === 0 ? '⚠ BOŞ' : '     ';
    console.log(`  ${flag} ${label.padEnd(26)} ${String(n).padStart(8)}`);
  }
  console.log(`\n  ${'Toplam'.padEnd(32)} ${String(total).padStart(8)} kayıt`);
}

// ── Export modu ─────────────────────────────────────

async function runExport() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  console.log('\n=== Referans Veri Export ===');
  console.log(`Kaynak : ${maskUrl(SOURCE_URL!)}`);
  console.log(`Hedef  : ${EXPORT_DIR}\n`);

  // FK sırasına uygun export; categories önce (parent önce çıkmalı)
  save('categories', await src.category.findMany({
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  }));

  save('markets', await src.market.findMany({
    orderBy: { name: 'asc' },
  }));

  save('market_branches', await src.marketBranch.findMany({
    orderBy: { marketId: 'asc' },
  }));

  save('products', await src.product.findMany({
    orderBy: { createdAt: 'asc' },
  }));

  save('barcodes', await src.barcode.findMany({
    orderBy: { createdAt: 'asc' },
  }));

  save('community_rewards', await src.communityReward.findMany({
    orderBy: { sortOrder: 'asc' },
  }));

  save('reward_coupon_codes', await src.rewardCouponCode.findMany({
    orderBy: { createdAt: 'asc' },
  }));

  save('prices', await src.price.findMany({
    orderBy: { createdAt: 'asc' },
  }));

  save('price_history', await src.priceHistory.findMany({
    orderBy: { recordedAt: 'asc' },
  }));

  save('catalogs', await src.catalog.findMany({
    orderBy: { startDate: 'asc' },
  }));

  save('catalog_pages', await src.catalogPage.findMany({
    orderBy: [{ catalogId: 'asc' }, { pageNumber: 'asc' }],
  }));

  // Dosya boyutlarını raporla
  const totalBytes = fs.readdirSync(EXPORT_DIR)
    .filter(f => f.endsWith('.json'))
    .reduce((sum, f) => sum + fs.statSync(path.join(EXPORT_DIR, f)).size, 0);

  console.log(`\n✅ Export tamamlandı`);
  console.log(`   Dizin : ${EXPORT_DIR}`);
  console.log(`   Boyut : ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nSonraki adım:');
  console.log('  TARGET_DATABASE_URL="postgresql://..." npm run db:import -- --clean');
}

// ── Ana giriş ───────────────────────────────────────

async function main() {
  if (process.argv.includes('--count')) {
    await countOnly();
  } else {
    await runExport();
  }
}

main()
  .catch((e) => { console.error('\n❌ Export hatası:', e.message); process.exit(1); })
  .finally(() => src.$disconnect());
