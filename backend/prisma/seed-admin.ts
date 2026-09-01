// =====================================================
// Yalnizca admin kullanicisi — canli DB icin guvenli seed
//
// Yerel:
//   npm run seed:admin
//
// Railway (DATABASE_URL ile):
//   railway run npm run seed:admin
//   veya yerelde: DATABASE_URL=... npm run seed:admin
//
// Production sifre: ADMIN_SEED_PASSWORD env (zorunlu)
// Demo sifre (Admin123!): ALLOW_DEMO_SEED=true ile
// =====================================================

import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL || 'admin@marketapp.com').trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDemo = process.env.ALLOW_DEMO_SEED === 'true';

  let password = process.env.ADMIN_SEED_PASSWORD?.trim();
  if (!password) {
    if (isProduction && !allowDemo) {
      console.error(
        'HATA: Production ortaminda ADMIN_SEED_PASSWORD veya ALLOW_DEMO_SEED=true gerekli.',
      );
      process.exit(1);
    }
    password = 'Admin123!';
    console.warn('UYARI: Varsayilan demo sifresi kullaniliyor (Admin123!).');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
      name: 'Sistem',
      surname: 'Yöneticisi',
    },
    create: {
      email,
      password: passwordHash,
      name: 'Sistem',
      surname: 'Yöneticisi',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`Admin kullanici hazir: ${admin.email} (${admin.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
