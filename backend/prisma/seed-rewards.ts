// =====================================================
// Topluluk Ödülleri Seed — anlaşmalı market kuponları
// npx ts-node prisma/seed-rewards.ts
// =====================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REWARD_DEFS = [
  {
    slug: 'gozlemci-bim',
    title: 'BİM Hoş Geldin Kuponu',
    description: 'Gözlemci seviyesine ulaştın — BİM\'de ilk alışverişine özel indirim.',
    benefitText: '75 TL ve üzeri alışverişte geçerli',
    discountLabel: '%3 İndirim',
    minReputation: 1.2,
    levelLabel: 'Gözlemci',
    levelIcon: '👀',
    marketSlug: 'bim',
    instructions: 'Kasada ödeme öncesi kupon kodunu gösterin veya online siparişte indirim alanına girin.',
    sortOrder: 1,
    codePrefix: 'BIM-GOZ',
  },
  {
    slug: 'fiyat-avcisi-a101',
    title: 'A101 Fiyat Avcısı Kuponu',
    description: 'Topluluğa aktif katkın karşılığında A101 partner indirimi.',
    benefitText: '100 TL ve üzeri alışverişte geçerli',
    discountLabel: '%5 İndirim',
    minReputation: 2.0,
    levelLabel: 'Fiyat Avcısı',
    levelIcon: '🎯',
    marketSlug: 'a101',
    instructions: 'A101 mağazasında kasada veya A101 Kapıda uygulamasında kullanın.',
    sortOrder: 2,
    codePrefix: 'A101-AVC',
  },
  {
    slug: 'guvenilir-sok',
    title: 'ŞOK Güvenilir Kaynak Kuponu',
    description: 'Fiyat bildirimlerin güvenilir sayılıyor — ŞOK\'tan özel avantaj.',
    benefitText: '150 TL ve üzeri alışverişte geçerli',
    discountLabel: '%8 İndirim',
    minReputation: 3.0,
    levelLabel: 'Güvenilir Kaynak',
    levelIcon: '⭐',
    marketSlug: 'sok',
    instructions: 'ŞOK market kasasında kupon kodunu paylaşın. Kampanya ürünleri hariçtir.',
    sortOrder: 3,
    codePrefix: 'SOK-GUV',
  },
  {
    slug: 'elci-carrefour',
    title: 'CarrefourSA Elçi Kuponu',
    description: 'En yüksek topluluk güveni — CarrefourSA\'dan premium indirim.',
    benefitText: '200 TL ve üzeri alışverişte geçerli',
    discountLabel: '%10 İndirim',
    minReputation: 4.2,
    levelLabel: 'Topluluk Elçisi',
    levelIcon: '🏆',
    marketSlug: 'carrefoursa',
    instructions: 'CarrefourSA online veya mağazada tek kullanımlık kupon. 30 gün geçerlidir.',
    sortOrder: 4,
    codePrefix: 'CS-ELC',
  },
];

async function main() {
  console.log('Topluluk ödülleri seed...');

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  for (const def of REWARD_DEFS) {
    const market = await prisma.market.findUnique({ where: { slug: def.marketSlug } });
    if (!market) {
      console.warn(`  Market bulunamadı: ${def.marketSlug}, atlanıyor`);
      continue;
    }

    const reward = await prisma.communityReward.upsert({
      where: { slug: def.slug },
      update: {
        title: def.title,
        description: def.description,
        benefitText: def.benefitText,
        discountLabel: def.discountLabel,
        minReputation: def.minReputation,
        levelLabel: def.levelLabel,
        levelIcon: def.levelIcon,
        instructions: def.instructions,
        sortOrder: def.sortOrder,
        marketId: market.id,
        isActive: true,
        codeMode: 'HYBRID',
        codePrefix: def.codePrefix,
        autoExpiresDays: 30,
      },
      create: {
        slug: def.slug,
        title: def.title,
        description: def.description,
        benefitText: def.benefitText,
        discountLabel: def.discountLabel,
        minReputation: def.minReputation,
        levelLabel: def.levelLabel,
        levelIcon: def.levelIcon,
        instructions: def.instructions,
        sortOrder: def.sortOrder,
        marketId: market.id,
        isActive: true,
        codeMode: 'HYBRID',
        codePrefix: def.codePrefix,
        autoExpiresDays: 30,
      },
    });

    const codes = Array.from({ length: 20 }, (_, i) =>
      `${def.codePrefix}-${String(i + 1).padStart(3, '0')}`,
    );

    await prisma.rewardCouponCode.createMany({
      data: codes.map((code) => ({ rewardId: reward.id, code, expiresAt })),
      skipDuplicates: true,
    });

    console.log(`  ${reward.title} — ${codes.length} kupon`);
  }

  console.log('Ödül seed tamamlandı.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
