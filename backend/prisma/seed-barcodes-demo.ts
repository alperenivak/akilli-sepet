// =====================================================
// Demo Barkod Seed — Sunum için gerçekçi EAN-13 barkodlar
//
// Sadece VAR OLAN ürünlere bağlanır.
// Ürün yoksa o barkodu atlar, hata vermez.
// Upsert: barkod zaten varsa günceller.
//
// Yerel:   npm run seed:barcodes:demo
// Railway: railway run npm run seed:barcodes:demo
// =====================================================

import { PrismaClient, BarcodeFormat } from '@prisma/client';

const prisma = new PrismaClient();

// Gerçek EAN-13 barkodlar — Türkiye markalarından
// productKeywords: product.name ILIKE '%keyword%' arama — öncelik sırasıyla dener
const DEMO_BARCODES: Array<{
  code:     string;
  format:   BarcodeFormat;
  keywords: string[];   // ilk eşleşen ürüne bağlanır
  label:    string;     // log için açıklama
}> = [
  // ── Süt & Süt Ürünleri ────────────────────────────
  { code: '8690637100964', format: BarcodeFormat.EAN_13, keywords: ['Sek Süt 1 L', 'Sek Süt'],            label: 'Sek Süt 1 L' },
  { code: '8680523100012', format: BarcodeFormat.EAN_13, keywords: ['Pınar UHT Süt', 'Pınar Süt 1'],      label: 'Pınar Süt 1 L' },
  { code: '8690803082216', format: BarcodeFormat.EAN_13, keywords: ['İçim Tam Yağlı', 'İçim Süt'],        label: 'İçim Süt 1 L' },

  // ── Yumurta ───────────────────────────────────────
  { code: '8690637218691', format: BarcodeFormat.EAN_13, keywords: ['Keskinoğlu 20\'li', 'Keskinoğlu Beyaz L Yumurta'], label: 'Keskinoğlu Yumurta 20li' },
  { code: '8682240100018', format: BarcodeFormat.EAN_13, keywords: ['Abalı Çiftliği Yumurta', 'Yumurta L Boy 30'],      label: 'Abalı Yumurta 30lu' },

  // ── Ekmek & Fırın ─────────────────────────────────
  { code: '8680161070016', format: BarcodeFormat.EAN_13, keywords: ['Papatya Ekmek', 'Ekmek Adet Küçük'], label: 'Papatya Ekmek' },

  // ── Yağ ───────────────────────────────────────────
  { code: '8690637100049', format: BarcodeFormat.EAN_13, keywords: ['Abalı Ayçiçek Yağı 5 L', 'Ayçiçek Yağı 5'], label: 'Abalı Ayçiçek Yağı 5L' },
  { code: '8690637210120', format: BarcodeFormat.EAN_13, keywords: ['Komili Ayçiçek', 'Komili Saf Ayçiçek'],      label: 'Komili Ayçiçek Yağı' },

  // ── Makarna ───────────────────────────────────────
  { code: '8690526085324', format: BarcodeFormat.EAN_13, keywords: ['Filiz Yumurtalı Bukle', 'Filiz Bukle'],    label: 'Filiz Bukle Makarna' },
  { code: '8690566091124', format: BarcodeFormat.EAN_13, keywords: ['Barilla Spagetti', 'Barilla Spaghetti'],   label: 'Barilla Spagetti' },

  // ── Peynir ────────────────────────────────────────
  { code: '8690175010239', format: BarcodeFormat.EAN_13, keywords: ['İçim Mini Top Peynir', 'Mini Top Peynir'], label: 'İçim Mini Top Peynir' },
  { code: '8690362010130', format: BarcodeFormat.EAN_13, keywords: ['Sütaş', 'Beyaz Peynir'],  label: 'Sütaş Beyaz Peynir' },

  // ── Su ────────────────────────────────────────────
  { code: '8690575891018', format: BarcodeFormat.EAN_13, keywords: ['Abant Doğal Kaynak Suyu 1,5', 'Abant 1,5 L'], label: 'Abant Su 1.5L' },
  { code: '8690575891025', format: BarcodeFormat.EAN_13, keywords: ['Abant Doğal Kaynak Suyu 500', 'Abant 500'],   label: 'Abant Su 500ml' },

  // ── Deterjan ──────────────────────────────────────
  { code: '8690947525821', format: BarcodeFormat.EAN_13, keywords: ['Bingo Elde Bulaşık', 'Bingo Bulaşık'], label: 'Bingo Bulaşık Deterjanı' },

  // ── Yoğurt ────────────────────────────────────────
  { code: '8690637161063', format: BarcodeFormat.EAN_13, keywords: ['Activia Doğal Probiyotik Sade', 'Activia Sade Yoğurt 4x100'], label: 'Activia Sade 4x100g' },
  { code: '8690637161070', format: BarcodeFormat.EAN_13, keywords: ['Activia Doğal Probiyotik Çilekli', 'Activia Çilekli 4'],      label: 'Activia Çilekli 4x100g' },
];

async function findProductByKeywords(keywords: string[]): Promise<{ id: string; name: string } | null> {
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
  console.log('\n=== Demo Barkod Seed Başlıyor ===\n');

  const productCount = await prisma.product.count({ where: { isActive: true } });
  if (productCount === 0) {
    console.error(
      '❌ HATA: products tablosu boş!\n'
      + '   Önce ürün verilerini import edin: npm run db:import',
    );
    process.exit(1);
  }
  console.log(`ℹ ${productCount} aktif ürün mevcut.\n`);

  let added    = 0;
  let updated  = 0;
  let notFound = 0;

  for (const demo of DEMO_BARCODES) {
    const product = await findProductByKeywords(demo.keywords);

    if (!product) {
      console.warn(`  ⚠ Ürün bulunamadı → "${demo.label}" (atlanıyor)`);
      notFound++;
      continue;
    }

    const existing = await prisma.barcode.findUnique({ where: { code: demo.code } });

    if (existing) {
      // Farklı ürüne bağlıysa düzelt
      if (existing.productId !== product.id) {
        await prisma.barcode.update({
          where: { code: demo.code },
          data: { productId: product.id },
        });
        console.log(`  🔄 Güncellendi: ${demo.code}  →  ${product.name.substring(0, 45)}`);
        updated++;
      } else {
        console.log(`  ↩ Zaten var:   ${demo.code}  →  ${product.name.substring(0, 45)}`);
      }
      continue;
    }

    await prisma.barcode.create({
      data: {
        code:      demo.code,
        format:    demo.format,
        productId: product.id,
      },
    });
    console.log(`  ✅ Eklendi:      ${demo.code}  →  ${product.name.substring(0, 45)}`);
    added++;
  }

  const total = await prisma.barcode.count();
  console.log(`\n✅ Tamamlandı: ${added} eklendi, ${updated} güncellendi, ${notFound} ürün bulunamadı`);
  console.log(`ℹ Toplam barkod: ${total}\n`);

  if (notFound > 0) {
    console.log(
      '💡 Bulunamayan ürünler için seed-barcodes-demo.ts içindeki\n'
      + '   "keywords" dizisini veritabanındaki gerçek ürün adlarıyla güncelleyin.\n',
    );
  }
}

main()
  .catch((e) => { console.error('\n❌ Hata:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
