// =====================================================
// Rol Seed — Inspector + Market Manager hesapları
// Mevcut kullanıcıları ve admin hesabını korur.
// Upsert kullanır; var olan hesap güncellenir, yoksa oluşturulur.
//
// Yerel:
//   npm run seed:roles
//
// Railway (production DB):
//   railway run npm run seed:roles
//   veya: DATABASE_URL="postgresql://..." npm run seed:roles
//
// Güvenlik: Şifreler bcrypt ile hash'lenir, plain text saklanmaz.
// =====================================================

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface UserDef {
  email: string;
  password: string;
  name: string;
  surname: string;
  role: UserRole;
  marketSlug?: string;  // MARKET_MANAGER için zorunlu
}

const USERS: UserDef[] = [
  // ─── Inspector ───────────────────────────────────
  {
    email: 'denetci@marketapp.com',
    password: 'Admin123!',
    name: 'Ali',
    surname: 'Denetçi',
    role: UserRole.INSPECTOR,
  },
  // ─── Market Managers ─────────────────────────────
  {
    email: 'yonetici@marketapp.com',
    password: 'yonetici123',
    name: 'Market',
    surname: 'Yöneticisi',
    role: UserRole.MARKET_MANAGER,
    marketSlug: 'migros',
  },
  {
    email: 'yonetici@migros.com',
    password: 'yonetici123',
    name: 'Migros',
    surname: 'Yöneticisi',
    role: UserRole.MARKET_MANAGER,
    marketSlug: 'migros',
  },
  {
    email: 'yonetici@a101.com',
    password: 'yonetici123',
    name: 'A101',
    surname: 'Yöneticisi',
    role: UserRole.MARKET_MANAGER,
    marketSlug: 'a101',
  },
  {
    email: 'yonetici@bim.com',
    password: 'yonetici123',
    name: 'BİM',
    surname: 'Yöneticisi',
    role: UserRole.MARKET_MANAGER,
    marketSlug: 'bim',
  },
  {
    email: 'yonetici@sokmarket.com',
    password: 'yonetici123',
    name: 'Şok Market',
    surname: 'Yöneticisi',
    role: UserRole.MARKET_MANAGER,
    marketSlug: 'sok',
  },
  {
    email: 'yonetici@carrefoursa.com',
    password: 'yonetici123',
    name: 'CarrefourSA',
    surname: 'Yöneticisi',
    role: UserRole.MARKET_MANAGER,
    marketSlug: 'carrefoursa',
  },
  {
    email: 'yonetici@macrocenter.com',
    password: 'yonetici123',
    name: 'Macrocenter',
    surname: 'Yöneticisi',
    role: UserRole.MARKET_MANAGER,
    marketSlug: 'macrocenter',
  },
];

async function main() {
  console.log('\n=== Rol Seed Başlıyor ===\n');

  // ── 1. Piyasa ID haritasını oluştur ──────────────
  const markets = await prisma.market.findMany({
    select: { id: true, slug: true, name: true },
  });

  if (markets.length === 0) {
    console.error(
      '❌ HATA: Veritabanında market bulunamadı!\n'
      + '   Önce market tablosunu doldurun:\n'
      + '   railway run npm run db:seed',
    );
    process.exit(1);
  }

  const marketMap = new Map(markets.map((m) => [m.slug, m]));

  console.log('Bulunan marketler:');
  markets.forEach((m) => console.log(`  ${m.slug.padEnd(14)} id=${m.id}`));
  console.log();

  // ── 2. Her kullanıcıyı upsert et ─────────────────
  let created = 0;
  let updated = 0;

  for (const def of USERS) {
    const hash = await bcrypt.hash(def.password, 10);
    let managedMarketId: string | null = null;

    if (def.marketSlug) {
      const market = marketMap.get(def.marketSlug);
      if (!market) {
        console.warn(
          `  ⚠ Market bulunamadı: "${def.marketSlug}" — ${def.email} atlanıyor`,
        );
        continue;
      }
      managedMarketId = market.id;
    }

    const existing = await prisma.user.findUnique({ where: { email: def.email } });

    await prisma.user.upsert({
      where: { email: def.email },
      update: {
        password: hash,
        role: def.role,
        isActive: true,
        emailVerified: true,
        managedMarketId,
      },
      create: {
        email: def.email,
        password: hash,
        name: def.name,
        surname: def.surname,
        role: def.role,
        isActive: true,
        emailVerified: true,
        managedMarketId,
      },
    });

    const icon   = def.role === UserRole.INSPECTOR ? '🔍' : '🏪';
    const market = def.marketSlug ? ` → ${def.marketSlug}` : '';
    const status = existing ? 'güncellendi' : 'oluşturuldu';

    console.log(
      `  ${icon} ${def.role.padEnd(16)} ${status.padEnd(11)} ${def.email}${market}`,
    );

    if (existing) updated++;
    else created++;
  }

  // ── 3. Özet ──────────────────────────────────────
  console.log(`\n✅ Tamamlandı: ${created} yeni, ${updated} güncellendi\n`);
  console.log('Test giriş bilgileri:');
  console.log('  Admin     : admin@marketapp.com          / Admin123!');
  console.log('  Inspector : denetci@marketapp.com        / Admin123!');
  console.log('  Market Mgr: yonetici@marketapp.com         / yonetici123');
  console.log('  Migros Mgr: yonetici@migros.com          / yonetici123');
  console.log('  A101 Mgr  : yonetici@a101.com            / yonetici123');
  console.log('  BİM Mgr   : yonetici@bim.com             / yonetici123\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Hata:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
