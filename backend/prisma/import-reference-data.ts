// =====================================================
// Referans Veri Import — JSON → Railway PostgreSQL
//
// Kullanım:
//   # Dry-run (hedefi değiştirmeden sayıları karşılaştır):
//   TARGET_DATABASE_URL="postgresql://..." npm run db:import -- --dry-run
//
//   # Temizleyerek import (ÖNERİLEN — ilk kez):
//   TARGET_DATABASE_URL="postgresql://..." npm run db:import -- --clean
//
//   # Temizlemeden upsert (sonraki çalıştırmalar için):
//   TARGET_DATABASE_URL="postgresql://..." npm run db:import
//
// Flags:
//   --clean     Import öncesi hedef tabloları temizler (TRUNCATE)
//   --dry-run   Dosyaları okur, sayıları basar, DB'ye dokunmaz
//   --skip-safety   Güvenlik sayım kontrolünü atlar
// =====================================================

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_URL = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;

if (!TARGET_URL) {
  console.error('HATA: TARGET_DATABASE_URL env değişkeni gerekli.');
  console.error('  Örnek: $env:TARGET_DATABASE_URL="postgresql://user:pass@host:5432/db"');
  process.exit(1);
}

const dst = new PrismaClient({
  datasources: { db: { url: TARGET_URL } },
  log: [],
});

const EXPORT_DIR = path.join(__dirname, 'data', 'export');
const BATCH_SIZE = 500;

const IS_CLEAN   = process.argv.includes('--clean');
const IS_DRY_RUN = process.argv.includes('--dry-run');
const SKIP_SAFETY = process.argv.includes('--skip-safety');

// ── Yardımcı fonksiyonlar ───────────────────────────

function maskUrl(url: string) {
  return url.replace(/:\/\/[^@]+@/, '://***@');
}

function loadJson<T>(name: string): T[] {
  const file = path.join(EXPORT_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`  ⚠  ${name}.json bulunamadı — atlanıyor`);
    return [];
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T[];
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Büyük listeleri BATCH_SIZE parçalara bölerek createMany */
async function batchInsert<T extends object>(
  label: string,
  rows: T[],
  fn: (batch: T[]) => Promise<Prisma.BatchPayload>,
): Promise<number> {
  if (rows.length === 0) {
    console.log(`  -  ${label.padEnd(26)}       0 kayıt (dosya boş)`);
    return 0;
  }
  let inserted = 0;
  for (const batch of chunks(rows, BATCH_SIZE)) {
    const { count } = await fn(batch);
    inserted += count;
  }
  console.log(`  ✓  ${label.padEnd(26)} ${String(inserted).padStart(7)} kayıt eklendi`);
  return inserted;
}

/** Toplu upsert — yalnızca mevcut kayıtlar için fallback */
async function batchUpsert<T extends { id: string }>(
  label: string,
  rows: T[],
  fn: (row: T) => Prisma.PrismaPromise<unknown>,
): Promise<number> {
  if (rows.length === 0) {
    console.log(`  -  ${label.padEnd(26)}       0 kayıt`);
    return 0;
  }
  let count = 0;
  for (const batch of chunks(rows, 50)) {      // upsert daha yavaş → küçük batch
    await dst.$transaction(batch.map(fn));
    count += batch.length;
    process.stdout.write(`\r  ↻  ${label.padEnd(26)} ${String(count).padStart(7)}/${rows.length}`);
  }
  console.log(`\r  ✓  ${label.padEnd(26)} ${String(count).padStart(7)} kayıt upsert`);
  return count;
}

// ── Güvenlik kontrolü ───────────────────────────────

async function safetyCheck() {
  console.log('\n── Güvenlik Kontrolü ──────────────────────────────');

  const [alertCount, submissionCount, claimCount] = await Promise.all([
    dst.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint as count FROM "price_alerts"`,
    dst.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint as count FROM "price_submissions"`,
    dst.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint as count FROM "user_reward_claims"`,
  ]);

  const alerts    = Number(alertCount[0].count);
  const subs      = Number(submissionCount[0].count);
  const claims    = Number(claimCount[0].count);

  if (alerts + subs + claims > 0) {
    console.warn(`\n  ⚠  Hedef DB'de kullanıcıya ait kayıtlar var:`);
    if (alerts)  console.warn(`       price_alerts:       ${alerts}`);
    if (subs)    console.warn(`       price_submissions:  ${subs}`);
    if (claims)  console.warn(`       user_reward_claims: ${claims}`);
    console.warn('\n  Bu kayıtlar import sonrası bozulmaz (FK cascade ile temizlenmez).');
    console.warn('  Devam etmek için tekrar çalıştır: --skip-safety\n');

    if (!SKIP_SAFETY) {
      await dst.$disconnect();
      process.exit(1);
    }
  } else {
    console.log('  ✓  Kullanıcı verisi boş — devam etmek güvenli\n');
  }
}

// ── Dry-run: sadece dosya istatistikleri ────────────

async function dryRun() {
  console.log('\n=== DRY-RUN — DB\'ye dokunulmaz ===\n');

  const tables = [
    'categories', 'markets', 'market_branches', 'products', 'barcodes',
    'community_rewards', 'reward_coupon_codes', 'prices', 'price_history',
    'catalogs', 'catalog_pages',
  ] as const;

  let totalLocal = 0, totalRemote = 0;

  const remoteCounts: Record<string, number> = {
    categories:          await dst.category.count(),
    markets:             await dst.market.count(),
    market_branches:     await dst.marketBranch.count(),
    products:            await dst.product.count(),
    barcodes:            await dst.barcode.count(),
    community_rewards:   await dst.communityReward.count(),
    reward_coupon_codes: await dst.rewardCouponCode.count(),
    prices:              await dst.price.count(),
    price_history:       await dst.priceHistory.count(),
    catalogs:            await dst.catalog.count(),
    catalog_pages:       await dst.catalogPage.count(),
  };

  console.log(`${'Tablo'.padEnd(28)} ${'JSON'.padStart(8)} ${'Railway'.padStart(10)}`);
  console.log('-'.repeat(50));

  for (const t of tables) {
    const rows = loadJson(t);
    const remote = remoteCounts[t] ?? 0;
    totalLocal  += rows.length;
    totalRemote += remote;
    const icon = remote === 0 ? '  ' : '⚠ ';
    console.log(`${icon}${t.padEnd(28)} ${String(rows.length).padStart(8)} ${String(remote).padStart(10)}`);
  }

  console.log('-'.repeat(50));
  console.log(`${'Toplam'.padEnd(28)} ${String(totalLocal).padStart(8)} ${String(totalRemote).padStart(10)}`);
  console.log('\n⚠  ≠ 0 olan Railway sütunları: --clean flag gerekebilir');
  console.log('Gerçek import için: --clean (boş hedef) veya salt upsert (çakışma varsa)');
}

// ── Temizleme (reverse FK order) ────────────────────

async function cleanTargetTables() {
  console.log('\n── Hedef Tablolar Temizleniyor ─────────────────────');
  console.log('  Sıra: catalog_pages → price_history → reward_coupon_codes');
  console.log('        → prices → barcodes → catalogs → community_rewards');
  console.log('        → market_branches → products → markets → categories\n');

  // Categories self-reference: önce parentId null yap
  await dst.$executeRaw`UPDATE "categories" SET "parentId" = NULL WHERE "parentId" IS NOT NULL`;

  // Reverse FK sırasıyla tek tek deleteMany (transaction dışı; sıra önemli)
  const steps: [string, () => Promise<Prisma.BatchPayload>][] = [
    ['catalog_pages',        () => dst.catalogPage.deleteMany()],
    ['price_history',        () => dst.priceHistory.deleteMany()],
    ['reward_coupon_codes',  () => dst.rewardCouponCode.deleteMany()],
    ['prices',               () => dst.price.deleteMany()],
    ['barcodes',             () => dst.barcode.deleteMany()],
    ['catalogs',             () => dst.catalog.deleteMany()],
    ['community_rewards',    () => dst.communityReward.deleteMany()],
    ['market_branches',      () => dst.marketBranch.deleteMany()],
    ['products',             () => dst.product.deleteMany()],
    ['markets',              () => dst.market.deleteMany()],
    ['categories',           () => dst.category.deleteMany()],
  ];

  for (const [label, fn] of steps) {
    const { count } = await fn();
    console.log(`  ✓  ${label.padEnd(24)} ${String(count).padStart(6)} silindi`);
  }
  console.log();
}

// ── İmport (FK order) ───────────────────────────────

async function runImport() {
  console.log('── Import Ediliyor (FK sırası) ─────────────────────\n');

  // 1. CATEGORIES — 2 geçiş (self-reference)
  const categories = loadJson<{
    id: string; name: string; slug: string; icon?: string | null;
    description?: string | null; imageUrl?: string | null;
    parentId?: string | null; isActive: boolean; sortOrder: number;
    createdAt: string; updatedAt: string;
  }>('categories');

  if (categories.length > 0) {
    // Geçiş 1: parentId=null ile insert
    const stripped = categories.map(({ parentId: _p, ...rest }) => ({
      ...rest, parentId: null,
    }));
    await batchInsert('categories (pass 1/2)', stripped, (batch) =>
      dst.category.createMany({ data: batch, skipDuplicates: true }),
    );

    // Geçiş 2: parentId güncelle
    const withParent = categories.filter((c) => c.parentId);
    if (withParent.length > 0) {
      for (const batch of chunks(withParent, 200)) {
        await dst.$transaction(
          batch.map((c) =>
            dst.category.update({ where: { id: c.id }, data: { parentId: c.parentId } }),
          ),
        );
      }
      console.log(`  ✓  ${'categories (pass 2/2)'.padEnd(26)} ${String(withParent.length).padStart(7)} parentId güncellendi`);
    }
  }

  // 2. MARKETS
  await batchInsert('markets', loadJson('markets'), (batch) =>
    dst.market.createMany({ data: batch, skipDuplicates: true }),
  );

  // 3. MARKET BRANCHES
  await batchInsert('market_branches', loadJson('market_branches'), (batch) =>
    dst.marketBranch.createMany({ data: batch, skipDuplicates: true }),
  );

  // 4. PRODUCTS
  await batchInsert('products', loadJson('products'), (batch) =>
    dst.product.createMany({ data: batch, skipDuplicates: true }),
  );

  // 5. BARCODES
  await batchInsert('barcodes', loadJson('barcodes'), (batch) =>
    dst.barcode.createMany({ data: batch, skipDuplicates: true }),
  );

  // 6. COMMUNITY REWARDS
  await batchInsert('community_rewards', loadJson('community_rewards'), (batch) =>
    dst.communityReward.createMany({ data: batch, skipDuplicates: true }),
  );

  // 7. REWARD COUPON CODES
  await batchInsert('reward_coupon_codes', loadJson('reward_coupon_codes'), (batch) =>
    dst.rewardCouponCode.createMany({ data: batch, skipDuplicates: true }),
  );

  // 8. PRICES
  await batchInsert('prices', loadJson('prices'), (batch) =>
    dst.price.createMany({ data: batch, skipDuplicates: true }),
  );

  // 9. PRICE HISTORY
  await batchInsert('price_history', loadJson('price_history'), (batch) =>
    dst.priceHistory.createMany({ data: batch, skipDuplicates: true }),
  );

  // 10. CATALOGS
  await batchInsert('catalogs', loadJson('catalogs'), (batch) =>
    dst.catalog.createMany({ data: batch, skipDuplicates: true }),
  );

  // 11. CATALOG PAGES
  await batchInsert('catalog_pages', loadJson('catalog_pages'), (batch) =>
    dst.catalogPage.createMany({ data: batch, skipDuplicates: true }),
  );
}

// ── Doğrulama ────────────────────────────────────────

async function verify() {
  console.log('\n── Doğrulama ───────────────────────────────────────\n');

  const [cat, mar, bra, pro, bar, rew, cod, pri, his, cat2, pag] = await Promise.all([
    dst.category.count(),
    dst.market.count(),
    dst.marketBranch.count(),
    dst.product.count(),
    dst.barcode.count(),
    dst.communityReward.count(),
    dst.rewardCouponCode.count(),
    dst.price.count(),
    dst.priceHistory.count(),
    dst.catalog.count(),
    dst.catalogPage.count(),
  ]);

  const rows: [string, number][] = [
    ['categories', cat], ['markets', mar], ['market_branches', bra],
    ['products', pro], ['barcodes', bar], ['community_rewards', rew],
    ['reward_coupon_codes', cod], ['prices', pri], ['price_history', his],
    ['catalogs', cat2], ['catalog_pages', pag],
  ];

  let allOk = true;
  for (const [label, count] of rows) {
    const srcCount = loadJson(label).length;
    const ok = count >= srcCount;
    if (!ok) allOk = false;
    const icon = ok ? '✓' : '✗';
    console.log(`  ${icon}  ${label.padEnd(26)} Railway: ${String(count).padStart(7)}  /  JSON: ${srcCount}`);
  }

  console.log();
  if (allOk) {
    console.log('✅ Tüm tablolar doğrulandı!\n');
  } else {
    console.warn('⚠  Bazı sayılar eksik — import logu kontrol edin.\n');
  }

  // Users kontrolü — dokunulmamış olmalı
  const userCount = await dst.$queryRaw<[{ count: bigint }]>
    `SELECT COUNT(*)::bigint as count FROM "users"`;
  console.log(`  👤 users tablosu: ${Number(userCount[0].count)} kayıt (dokunulmadı)`);
}

// ── Ana giriş ───────────────────────────────────────

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║       Referans Veri Import — Akıllı Sepet         ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`\nHedef  : ${maskUrl(TARGET_URL!)}`);
  console.log(`Mod    : ${IS_DRY_RUN ? 'DRY-RUN' : IS_CLEAN ? 'CLEAN + INSERT' : 'UPSERT (skipDuplicates)'}`);

  if (IS_DRY_RUN) {
    await dryRun();
    return;
  }

  if (!SKIP_SAFETY) await safetyCheck();

  if (IS_CLEAN) await cleanTargetTables();

  await runImport();
  await verify();

  console.log('─'.repeat(52));
  console.log('Sonraki adım:');
  console.log('  1. Admin panel: https://admin.akilli-sepet.com');
  console.log('  2. Mobile: Ürün arama ve fiyat karşılaştırma test edin');
  console.log('  3. Backend log: Railway dashboard → Logs\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Import hatası:', e.message);
    if (e.code) console.error('   Kod:', e.code);
    process.exit(1);
  })
  .finally(() => dst.$disconnect());
