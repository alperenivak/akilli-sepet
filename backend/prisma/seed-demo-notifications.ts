// =====================================================
// Demo Bildirim Seed Scripti
// Sunum için kullanıcılara gerçekçi bildirimler ekler
// Kullanım: npm run seed:notifications:demo
// =====================================================

import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

interface DemoNotification {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    type: NotificationType.PRICE_DROP,
    title: '📉 Pınar Süt fiyatı düştü!',
    body: 'Takip ettiğiniz Pınar Süt 1L ŞOK\'ta 65,30₺\'den 59,90₺\'ye indi. Hemen sepete ekleyin!',
    data: { action: 'OPEN_PRODUCT' },
  },
  {
    type: NotificationType.PRICE_DROP,
    title: '📉 Barilla Spagetti indirimde!',
    body: 'Barilla Spagetti 500G Migros\'ta bu hafta %15 indirimli. Fırsatı kaçırmayın.',
    data: { action: 'OPEN_PRODUCT' },
  },
  {
    type: NotificationType.PRICE_ALERT,
    title: '🔔 Fiyat alarmınız tetiklendi!',
    body: 'Abant Su 1.5L için belirlediğiniz 15,00₺ hedef fiyatına ulaşıldı. Şimdi satın alın!',
    data: { action: 'OPEN_PRODUCT' },
  },
  {
    type: NotificationType.NEW_CATALOG,
    title: '📖 BİM\'in yeni aktüeli yayında!',
    body: 'BİM bu haftaki aktüel ürünleri güncellendi. Yüzlerce ürünü keşfedin.',
    data: { action: 'OPEN_CATALOGS' },
  },
  {
    type: NotificationType.NEW_CATALOG,
    title: '📖 A101 aktüel kataloğu çıktı!',
    body: 'A101 bu hafta 120\'den fazla ürünü indirimde sunuyor. Şimdi inceleyin.',
    data: { action: 'OPEN_CATALOGS' },
  },
  {
    type: NotificationType.AI_RECOMMENDATION,
    title: '🤖 Akıllı Sepet önerisi',
    body: 'Geçen ay alışverişlerinize göre: Migros ve ŞOK\'tan alım yaparak bu ay 87₺ tasarruf edebilirsiniz.',
    data: { action: 'OPEN_CART' },
  },
  {
    type: NotificationType.AI_RECOMMENDATION,
    title: '🤖 Sepet optimizasyonu hazır',
    body: 'Sepetinizdeki 5 ürün için en ucuz market kombinasyonu bulundu. 3 marketten alarak 45₺ kazanın.',
    data: { action: 'OPEN_CART' },
  },
  {
    type: NotificationType.REPORT_STATUS,
    title: '✅ İhbarınız onaylandı!',
    body: 'Migros Kadıköy şubesindeki son kullanma tarihi geçmiş ürün ihbarınız onaylandı. +15 itibar puanı kazandınız!',
    data: { action: 'OPEN_REPORTS' },
  },
  {
    type: NotificationType.SYSTEM,
    title: '🎉 Hoş geldiniz!',
    body: 'Akıllı Sepet\'e kayıt olduğunuz için teşekkürler. İlk fiyat karşılaştırmanızı yapın ve tasarrufa başlayın.',
    data: { action: 'OPEN_HOME' },
  },
];

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     Demo Bildirim Seed — Akıllı Sepet        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Tüm aktif kullanıcıları bul (admin hariç)
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, name: true },
    take: 10,
  });

  if (users.length === 0) {
    console.log('❌ Kullanıcı bulunamadı.');
    return;
  }

  console.log(`👥 ${users.length} kullanıcı bulundu\n`);

  let totalCreated = 0;

  for (const user of users) {
    // Zaten bildirimi olan kullanıcıları atla
    const existing = await prisma.notification.count({ where: { userId: user.id } });
    if (existing > 0) {
      console.log(`  ⏭  ${user.email} — zaten ${existing} bildirimi var, atlandı`);
      continue;
    }

    // Kullanıcıya uygun sayıda bildirim ekle (3-9 arası)
    const count = Math.floor(Math.random() * 7) + 3;
    const selected = DEMO_NOTIFICATIONS.slice(0, count);

    for (let i = 0; i < selected.length; i++) {
      const notif = selected[i];
      // Farklı zamanlarda gelmiş gibi göster
      const minsAgo = (i + 1) * Math.floor(Math.random() * 60 + 20);
      const createdAt = new Date(Date.now() - minsAgo * 60 * 1000);

      await prisma.notification.create({
        data: {
          userId: user.id,
          title: notif.title,
          body: notif.body,
          type: notif.type,
          data: notif.data ?? {},
          isRead: i > 2, // İlk 3 okunmamış, diğerleri okunmuş
          createdAt,
        },
      });
      totalCreated++;
    }

    console.log(`  ✓  ${user.email} — ${count} bildirim eklendi`);
  }

  console.log(`\n✅ Toplam ${totalCreated} bildirim oluşturuldu`);
  console.log('\nNotlar:');
  console.log('  • İlk 3 bildirim okunmamış olarak işaretlendi');
  console.log('  • Profil sekmesinde kırmızı rozet görünecek');
  console.log('  • Bildirimler sekmesinde tümü listeleniyor');
}

main()
  .catch((e) => { console.error('❌ Hata:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
