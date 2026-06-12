// =====================================================
// Market Şubeleri Seed — OSM gerçek konumlar (İstanbul + Ankara)
// npx ts-node -r tsconfig-paths/register prisma/seed-branches.ts
// npx ts-node ... prisma/seed-branches.ts --refresh  (OSM'den yeniden çek)
// =====================================================

import { PrismaClient } from '@prisma/client';
import {
  fetchAllOsmBranches, loadCache, saveCache, OsmBranchRow, MARKET_BRAND_MAP,
  uniquifyBranchNames, refreshBranchName,
} from './lib/osm-branches';

const prisma = new PrismaClient();
const DEMO_BRANCH_IDS = [
  'branch-migros-kadikoy', 'branch-migros-besiktas',
  'branch-bim-uskudar', 'branch-bim-sisli',
  'branch-a101-maltepe', 'branch-sok-fatih', 'branch-carrefour-bakirkoy',
];

async function main() {
  const refresh = process.argv.includes('--refresh');
  console.log('Market şubeleri seed başlıyor…');

  const markets = await prisma.market.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
  });

  const slugs = markets.map((m) => m.slug).filter((s) => s in MARKET_BRAND_MAP);
  const slugToId = new Map(markets.map((m) => [m.slug, m.id]));

  console.log(`Aktif marketler: ${slugs.join(', ')}`);

  // Demo şubeleri kaldır
  const deletedDemo = await prisma.marketBranch.deleteMany({
    where: { id: { in: DEMO_BRANCH_IDS } },
  });
  const deletedAll = await prisma.marketBranch.deleteMany({
    where: { market: { slug: { in: slugs } } },
  });
  console.log(`Eski şubeler silindi: ${deletedDemo.count + deletedAll.count}`);

  let rows: OsmBranchRow[] | null = null;

  if (!refresh) {
    rows = loadCache();
    if (rows?.length) console.log(`Önbellekten ${rows.length} şube yüklendi.`);
  }

  if (!rows?.length) {
    console.log('OpenStreetMap Overpass API\'den çekiliyor (İstanbul + Ankara)…');
    console.log('Bu işlem birkaç dakika sürebilir…');
    rows = await fetchAllOsmBranches(slugs, (msg) => console.log(`  ${msg}`));
    if (rows.length > 0) {
      saveCache(rows);
      console.log(`Önbellek kaydedildi (${rows.length} şube).`);
    }
  }

  if (!rows.length) {
    console.error('OSM\'den şube alınamadı. --refresh ile tekrar deneyin.');
    process.exit(1);
  }

  // Onbellekten gelse bile adres/ilce ile isimleri yeniden uret
  rows = uniquifyBranchNames(
    rows.map((r) => ({ ...r, name: refreshBranchName(r) })),
  );

  const data = uniquifyBranchNames(
    rows
      .filter((r) => slugToId.has(r.marketSlug))
      .map((r) => ({
        id: `branch-${r.marketSlug}-${r.osmId}`,
        marketId: slugToId.get(r.marketSlug)!,
        marketSlug: r.marketSlug,
        name: r.name,
        address: r.address,
        city: r.city,
        district: r.district ?? null,
        latitude: r.latitude,
        longitude: r.longitude,
        phone: r.phone ?? null,
        workingHours: r.workingHours ?? null,
        isActive: true,
      })),
  );

  let upserted = 0;
  for (const row of data) {
    const { marketSlug: _slug, ...branchData } = row;
    await prisma.marketBranch.upsert({
      where: { id: row.id },
      create: branchData,
      update: {
        name: branchData.name,
        address: branchData.address,
        city: branchData.city,
        district: branchData.district,
        latitude: branchData.latitude,
        longitude: branchData.longitude,
        phone: branchData.phone,
        workingHours: branchData.workingHours,
        isActive: true,
      },
    });
    upserted++;
  }

  const byMarket = await prisma.marketBranch.groupBy({
    by: ['marketId'],
    _count: true,
  });

  console.log('\nÖzet:');
  for (const m of markets) {
    const cnt = byMarket.find((b) => b.marketId === m.id)?._count ?? 0;
    console.log(`  ${m.name}: ${cnt} şube`);
  }
  console.log(`\nToplam ${upserted} şube kaydedildi/güncellendi (OSM kaynaklı, İstanbul + Ankara).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
