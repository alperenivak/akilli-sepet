// =====================================================
// Akıllı Sepet - Prisma Seed Dosyasi
// Demo verisi: Admin + Kategoriler + Marketler + Urunler + Fiyatlar + Kataloglar + Ihbarlar
//
// Calistirmak icin: npx prisma db seed
// =====================================================

import {
  PrismaClient, UserRole, PriceSource, ReportStatus, BarcodeFormat, ScraperType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed baslatiliyor...');

  // Eski demo e-postalarini yeni adrese tasima
  const legacyEmailMap: Record<string, string> = {
    'admin@Akıllı Sepet.com': 'admin@marketapp.com',
    'denetci@Akıllı Sepet.com': 'denetci@marketapp.com',
    'kullanici@Akıllı Sepet.com': 'kullanici@marketapp.com',
  };
  for (const [oldEmail, newEmail] of Object.entries(legacyEmailMap)) {
    await prisma.user.updateMany({
      where: { email: oldEmail },
      data: { email: newEmail },
    });
  }

  // =====================================================
  // 1. KULLANICILAR
  // =====================================================

  const passwordHash = await bcrypt.hash('Admin123!', 10);
  const userPasswordHash = await bcrypt.hash('User123!', 10);
  const managerPasswordHash = await bcrypt.hash('yonetici123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@marketapp.com' },
    update: { emailVerified: true },
    create: {
      email: 'admin@marketapp.com',
      password: passwordHash,
      name: 'Sistem',
      surname: 'Yöneticisi',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`  Kullanici: ${superAdmin.email} (SUPER_ADMIN)`);

  const inspector = await prisma.user.upsert({
    where: { email: 'denetci@marketapp.com' },
    update: { emailVerified: true },
    create: {
      email: 'denetci@marketapp.com',
      password: passwordHash,
      name: 'Ali',
      surname: 'Denetçi',
      role: UserRole.INSPECTOR,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`  Kullanici: ${inspector.email} (INSPECTOR)`);

  const normalUser = await prisma.user.upsert({
    where: { email: 'kullanici@marketapp.com' },
    update: { emailVerified: true },
    create: {
      email: 'kullanici@marketapp.com',
      password: userPasswordHash,
      name: 'Ayşe',
      surname: 'Kullanıcı',
      role: UserRole.USER,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`  Kullanici: ${normalUser.email} (USER)`);

  // =====================================================
  // 2. KATEGORİLER (9 ana kategori)
  // =====================================================

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'meyve-sebze' },
      update: {},
      create: { name: 'Meyve & Sebze', slug: 'meyve-sebze', icon: '🥦', sortOrder: 1, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'sut-urunleri' },
      update: {},
      create: { name: 'Süt Ürünleri', slug: 'sut-urunleri', icon: '🥛', sortOrder: 2, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'et-tavuk' },
      update: {},
      create: { name: 'Et & Tavuk', slug: 'et-tavuk', icon: '🍗', sortOrder: 3, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'icecekler' },
      update: {},
      create: { name: 'İçecekler', slug: 'icecekler', icon: '🧃', sortOrder: 4, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'gida' },
      update: {},
      create: { name: 'Gıda', slug: 'gida', icon: '🍞', sortOrder: 5, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'temizlik' },
      update: {},
      create: { name: 'Temizlik', slug: 'temizlik', icon: '🧹', sortOrder: 6, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'kisisel-bakim' },
      update: {},
      create: { name: 'Kişisel Bakım', slug: 'kisisel-bakim', icon: '🧴', sortOrder: 7, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'dondurulmus' },
      update: {},
      create: { name: 'Dondurulmuş', slug: 'dondurulmus', icon: '🧊', sortOrder: 8, isActive: true },
    }),
    prisma.category.upsert({
      where: { slug: 'atistirmalik' },
      update: {},
      create: { name: 'Atıştırmalık', slug: 'atistirmalik', icon: '🍪', sortOrder: 9, isActive: true },
    }),
  ]);

  const [catMeyveSebze, catSut, catEt, catIcecek, catGida, catTemizlik, catKisisel, catDondurulmus, catAtistirmalik] = categories;
  console.log(`  ${categories.length} ana kategori olusturuldu`);

  // =====================================================
  // 2b. ALT KATEGORİLER (her ana kategori altinda)
  // =====================================================

  async function upsertSub(
    slug: string,
    name: string,
    icon: string,
    parentId: string,
    sortOrder: number,
  ) {
    return prisma.category.upsert({
      where: { slug },
      update: { name, icon, parentId, sortOrder, isActive: true },
      create: { name, slug, icon, parentId, sortOrder, isActive: true },
    });
  }

  const subMeyve     = await upsertSub('meyve',           'Meyve',              '🍎', catMeyveSebze.id, 1);
  const subSebze     = await upsertSub('sebze',           'Sebze',              '🥬', catMeyveSebze.id, 2);
  const subSut       = await upsertSub('sut',             'Süt',                '🥛', catSut.id, 1);
  const subPeynir    = await upsertSub('peynir',          'Peynir',             '🧀', catSut.id, 2);
  const subYogurt    = await upsertSub('yogurt',          'Yoğurt',             '🫙', catSut.id, 3);
  const subKirmiziEt = await upsertSub('kirmizi-et',      'Kırmızı Et',         '🥩', catEt.id, 1);
  const subTavuk     = await upsertSub('tavuk',           'Tavuk',              '🍗', catEt.id, 2);
  const subSarkuteri = await upsertSub('sarkuteri',       'Şarküteri',          '🥓', catEt.id, 3);
  const subSu        = await upsertSub('su-maden-suyu',   'Su & Maden Suyu',    '💧', catIcecek.id, 1);
  const subMesrubat  = await upsertSub('mesrubat',        'Meşrubat',           '🥤', catIcecek.id, 2);
  const subCayKahve  = await upsertSub('cay-kahve',       'Çay & Kahve',        '☕', catIcecek.id, 3);
  const subMeyveSuyu = await upsertSub('meyve-suyu',      'Meyve Suyu',         '🍊', catIcecek.id, 4);
  const subMakarna   = await upsertSub('makarna-pirinc',  'Makarna & Pirinç',   '🍝', catGida.id, 1);
  const subYagSalca  = await upsertSub('yag-salca',       'Yağ & Salça',        '🫒', catGida.id, 2);
  const subUnSeker   = await upsertSub('un-seker',        'Un & Şeker',         '🌾', catGida.id, 3);
  const subCamasir   = await upsertSub('camasir',         'Çamaşır',            '🧺', catTemizlik.id, 1);
  const subBulasik   = await upsertSub('bulasik',         'Bulaşık',            '🍽️', catTemizlik.id, 2);
  const subAgiz      = await upsertSub('agiz-bakimi',     'Ağız Bakımı',        '🪥', catKisisel.id, 1);
  const subSac       = await upsertSub('sac-bakimi',      'Saç Bakımı',         '💇', catKisisel.id, 2);
  const subDondSebze = await upsertSub('dondurulmus-sebze','Dondurulmuş Sebze', '🫛', catDondurulmus.id, 1);
  const subDondEt    = await upsertSub('dondurulmus-et',  'Dondurulmuş Et',     '🍖', catDondurulmus.id, 2);
  const subCikolata  = await upsertSub('cikolata-gofret', 'Çikolata & Gofret',  '🍫', catAtistirmalik.id, 1);
  const subCips      = await upsertSub('cips',            'Cips',               '🥔', catAtistirmalik.id, 2);
  const subBiskuvi   = await upsertSub('biskuvi',         'Bisküvi',            '🍪', catAtistirmalik.id, 3);

  console.log('  Alt kategoriler olusturuldu');

  // =====================================================
  // 3. MARKETLER + SUBELER
  // =====================================================

  const migros = await prisma.market.upsert({
    where: { slug: 'migros' },
    update: {
      scraperEnabled: true,
      scraperType: ScraperType.MIGROS_API,
      website: 'https://www.migros.com.tr',
    },
    create: {
      name: 'Migros',
      slug: 'migros',
      brandColor: '#E32929',
      website: 'https://www.migros.com.tr',
      description: 'Türkiye\'nin köklü süpermarket zinciri',
      scraperEnabled: true,
      scraperType: ScraperType.MIGROS_API,
      isActive: true,
    },
  });

  const bim = await prisma.market.upsert({
    where: { slug: 'bim' },
    update: {},
    create: {
      name: 'BİM',
      slug: 'bim',
      brandColor: '#E8002D',
      website: 'https://www.bim.com.tr',
      description: 'Her gün düşük fiyat marketi',
      isActive: true,
    },
  });

  const a101 = await prisma.market.upsert({
    where: { slug: 'a101' },
    update: {
      scraperEnabled: true,
      scraperType: ScraperType.SITEMAP_HTML,
      sitemapUrl: 'https://www.a101.com.tr/sitemap.xml',
      scraperNameSelector: 'h1',
      scraperPriceSelector: '.price',
      // Sadece ortak markalarin (Coca-Cola, Ulker, Pinar vs.) bulundugu kategoriler
      scraperUrlPattern: '/kapida/su-icecek|/kapida/sut-urunleri-kahvaltilik|/kapida/atistirmalik|/kapida/temel-gida|/kapida/temizlik-urunleri|/kapida/kisisel-bakim|/kapida/kagit-urunleri|/kapida/icecek',
    },
    create: {
      name: 'A101',
      slug: 'a101',
      brandColor: '#EE3124',
      website: 'https://www.a101.com.tr',
      description: 'Her şey A101\'de başlar',
      scraperEnabled: true,
      scraperType: ScraperType.SITEMAP_HTML,
      sitemapUrl: 'https://www.a101.com.tr/sitemap.xml',
      scraperNameSelector: 'h1',
      scraperPriceSelector: '.price',
      scraperUrlPattern: '/kapida/su-icecek|/kapida/sut-urunleri-kahvaltilik|/kapida/atistirmalik|/kapida/temel-gida|/kapida/temizlik-urunleri|/kapida/kisisel-bakim|/kapida/kagit-urunleri|/kapida/icecek',
      isActive: true,
    },
  });

  const sok = await prisma.market.upsert({
    where: { slug: 'sok' },
    update: {},
    create: {
      name: 'ŞOK',
      slug: 'sok',
      brandColor: '#FFC800',
      website: 'https://www.sokmarket.com.tr',
      description: 'Şok fiyatlar burada!',
      isActive: true,
    },
  });

  // CarrefourSA — Cloudflare WAF tarafindan tamamen engelleniyor (403), scraper kapali
  const carrefour = await prisma.market.upsert({
    where: { slug: 'carrefoursa' },
    update: {
      scraperEnabled: false,
    },
    create: {
      name: 'CarrefourSA',
      slug: 'carrefoursa',
      brandColor: '#0055A5',
      website: 'https://www.carrefoursa.com',
      description: 'Daha fazlası için CarrefourSA',
      scraperEnabled: false,
      isActive: true,
    },
  });

  // Macrocenter — sitemap acik, HTML urun sayfasi erisilebilir
  const macrocenter = await prisma.market.upsert({
    where: { slug: 'macrocenter' },
    update: {
      scraperEnabled: true,
      scraperType: ScraperType.SITEMAP_HTML,
      sitemapUrl: 'https://www.macrocenter.com.tr/hermes/api/sitemaps/sitemap.xml',
      scraperNameSelector: 'h1',
      scraperPriceSelector: '.price-no-discount, .price.subtitle-1, .price',
      scraperUrlPattern: '-p-',
    },
    create: {
      name: 'Macrocenter',
      slug: 'macrocenter',
      brandColor: '#E3000F',
      website: 'https://www.macrocenter.com.tr',
      description: 'Macrocenter - Geniş ürün yelpazesi',
      scraperEnabled: true,
      scraperType: ScraperType.SITEMAP_HTML,
      sitemapUrl: 'https://www.macrocenter.com.tr/hermes/api/sitemaps/sitemap.xml',
      scraperNameSelector: 'h1',
      scraperPriceSelector: '.price-no-discount, .price.subtitle-1, .price',
      scraperUrlPattern: '-p-',
      isActive: true,
    },
  });

  console.log('  6 market olusturuldu');

  // Market Yoneticileri
  const marketManagers = [
    { email: 'yonetici@marketapp.com',     name: 'Market',       surname: 'Yöneticisi', market: migros },
    { email: 'yonetici@migros.com',        name: 'Migros',       surname: 'Yöneticisi', market: migros },
    { email: 'yonetici@a101.com',          name: 'A101',         surname: 'Yöneticisi', market: a101 },
    { email: 'yonetici@bim.com',           name: 'BİM',          surname: 'Yöneticisi', market: bim },
    { email: 'yonetici@sokmarket.com',     name: 'Şok Market',   surname: 'Yöneticisi', market: sok },
    { email: 'yonetici@carrefoursa.com',   name: 'CarrefourSA',  surname: 'Yöneticisi', market: carrefour },
    { email: 'yonetici@macrocenter.com',   name: 'Macrocenter',  surname: 'Yöneticisi', market: macrocenter },
  ];

  for (const mgr of marketManagers) {
    const u = await prisma.user.upsert({
      where: { email: mgr.email },
      update: { password: managerPasswordHash, managedMarketId: mgr.market.id, emailVerified: true },
      create: {
        email: mgr.email,
        password: managerPasswordHash,
        name: mgr.name,
        surname: mgr.surname,
        role: UserRole.MARKET_MANAGER,
        isActive: true,
        emailVerified: true,
        managedMarketId: mgr.market.id,
      },
    });
    console.log(`  Kullanici: ${u.email} (MARKET_MANAGER -> ${mgr.market.name})`);
  }

  // Şubeler — demo kaldırıldı; gerçek OSM konumları: npm run seed:branches
  console.log('  Sube seeding atlandi (npm run seed:branches ile OSM verisi yukleyin)');

  // =====================================================
  // 4. ÜRÜNLER — Demo urunler kaldirildi. Tum veriler scraper tarafindan eklenir.
  // =====================================================

  // Demo urun ve fiyat seeding artik yapilmiyor.
  // Migros / A101 / Macrocenter scraperlarindan gelen gercek veriler kullanilir.
  console.log('  Demo urun seeding atlandi (scraper verisine gecildi)');

  /* KALDIRILDI — demo productDefs ve priceTable
  const productDefs = [
    // --- Süt Ürünleri ---
    { name: 'Tam Yağlı Süt', brand: 'Pınar', barcode: '8690526085013', categoryId: subSut.id, unit: 'ml', unitValue: 1000, slug: 'pinar-tam-yaglis-sut-1lt' },
    { name: 'Yarım Yağlı Süt', brand: 'Sek', barcode: '8690004020109', categoryId: subSut.id, unit: 'ml', unitValue: 1000, slug: 'sek-yarim-yaglis-sut-1lt' },
    { name: 'Beyaz Peynir', brand: 'Sütaş', barcode: '8690804018917', categoryId: subPeynir.id, unit: 'g', unitValue: 400, slug: 'sutas-beyaz-peynir-400g' },
    { name: 'Kaşar Peyniri', brand: 'Pınar', barcode: '8690526025513', categoryId: subPeynir.id, unit: 'g', unitValue: 400, slug: 'pinar-kasar-peyniri-400g' },
    { name: 'Yoğurt', brand: 'Danone', barcode: '8690605020016', categoryId: subYogurt.id, unit: 'g', unitValue: 500, slug: 'danone-yogurt-500g' },

    // --- Gıda ---
    { name: 'Makarna (Boru)', brand: 'Barilla', barcode: '8076800105117', categoryId: subMakarna.id, unit: 'g', unitValue: 500, slug: 'barilla-boru-makarna-500g' },
    { name: 'Şehriye', brand: 'Pastavilla', barcode: '8690504003021', categoryId: subMakarna.id, unit: 'g', unitValue: 500, slug: 'pastavilla-sehriye-500g' },
    { name: 'Pirinç', brand: 'Ülker', barcode: '8690540020019', categoryId: subMakarna.id, unit: 'kg', unitValue: 1, slug: 'ulker-princ-1kg' },
    { name: 'Domates Salçası', brand: 'Tukaş', barcode: '8690526019925', categoryId: subYagSalca.id, unit: 'g', unitValue: 830, slug: 'tukas-domates-salcasi-830g' },
    { name: 'Zeytinyağı', brand: 'Komili', barcode: '8690504510027', categoryId: subYagSalca.id, unit: 'ml', unitValue: 500, slug: 'komili-zeytinyagi-500ml' },
    { name: 'Ayçiçek Yağı', brand: 'Yudum', barcode: '8690526013718', categoryId: subYagSalca.id, unit: 'ml', unitValue: 1000, slug: 'yudum-aycicek-yagi-1lt' },
    { name: 'Şeker', brand: 'Torku', barcode: '8691219001149', categoryId: subUnSeker.id, unit: 'kg', unitValue: 1, slug: 'torku-seker-1kg' },
    { name: 'Un', brand: 'Sokak', barcode: '8690526020129', categoryId: subUnSeker.id, unit: 'kg', unitValue: 1, slug: 'sokak-un-1kg' },

    // --- İçecekler ---
    { name: 'Doğal Kaynak Suyu', brand: 'Erikli', barcode: '8690526024011', categoryId: subSu.id, unit: 'ml', unitValue: 1500, slug: 'erikli-kaynak-suyu-15lt' },
    { name: 'Maden Suyu', brand: 'Şıra', barcode: '8690526010046', categoryId: subSu.id, unit: 'ml', unitValue: 1000, slug: 'sira-maden-suyu-1lt' },
    { name: 'Portakal Suyu', brand: 'Cappy', barcode: '5449000133328', categoryId: subMeyveSuyu.id, unit: 'ml', unitValue: 1000, slug: 'cappy-portakal-suyu-1lt' },
    { name: 'Cola', brand: 'Coca-Cola', barcode: '5449000000996', categoryId: subMesrubat.id, unit: 'ml', unitValue: 1000, slug: 'coca-cola-1lt' },
    { name: 'Çay', brand: 'Çaykur', barcode: '8690526004014', categoryId: subCayKahve.id, unit: 'g', unitValue: 500, slug: 'caykur-cay-500g' },

    // --- Meyve & Sebze ---
    { name: 'Domates (Kg)', brand: null, barcode: '2000000000001', categoryId: subSebze.id, unit: 'kg', unitValue: 1, slug: 'domates-1kg' },
    { name: 'Salatalık (Kg)', brand: null, barcode: '2000000000002', categoryId: subSebze.id, unit: 'kg', unitValue: 1, slug: 'salatalik-1kg' },
    { name: 'Elma (Kg)', brand: null, barcode: '2000000000003', categoryId: subMeyve.id, unit: 'kg', unitValue: 1, slug: 'elma-1kg' },

    // --- Atıştırmalık ---
    { name: 'Çikolatalı Gofret', brand: 'Ülker', barcode: '8690504011057', categoryId: subCikolata.id, unit: 'g', unitValue: 36, slug: 'ulker-cikolatali-gofret-36g' },
    { name: 'Cips (Orijinal)', brand: 'Lay\'s', barcode: '8690631005062', categoryId: subCips.id, unit: 'g', unitValue: 100, slug: 'lays-cips-orijinal-100g' },
    { name: 'Bisküvi', brand: 'Ülker', barcode: '8690504029007', categoryId: subBiskuvi.id, unit: 'g', unitValue: 82, slug: 'ulker-biskuvi-82g' },

    // --- Temizlik ---
    { name: 'Çamaşır Deterjanı', brand: 'Ariel', barcode: '8001090702739', categoryId: subCamasir.id, unit: 'g', unitValue: 1000, slug: 'ariel-camasir-deterjani-1kg' },
    { name: 'Bulaşık Deterjanı', brand: 'Fairy', barcode: '8001090197184', categoryId: subBulasik.id, unit: 'ml', unitValue: 650, slug: 'fairy-bulasik-deterjani-650ml' },
    { name: 'Yumuşatıcı', brand: 'Comfort', barcode: '8690637028017', categoryId: subCamasir.id, unit: 'ml', unitValue: 1500, slug: 'comfort-yumusatici-15lt' },

    // --- Kişisel Bakım ---
    { name: 'Diş Macunu', brand: 'Colgate', barcode: '8714789893907', categoryId: subAgiz.id, unit: 'ml', unitValue: 75, slug: 'colgate-dis-macunu-75ml' },
    { name: 'Şampuan', brand: 'Head & Shoulders', barcode: '4084500009493', categoryId: subSac.id, unit: 'ml', unitValue: 250, slug: 'hs-sampuan-250ml' },

    // --- Dondurulmuş ---
    { name: 'Dondurulmuş Bezelye', brand: 'Bonduelle', barcode: '3083681083101', categoryId: subDondSebze.id, unit: 'g', unitValue: 400, slug: 'bonduelle-dondurulmus-bezelye-400g' },
    { name: 'Dondurulmuş Köfte', brand: 'Kerevitaş', barcode: '8690526070804', categoryId: subDondEt.id, unit: 'g', unitValue: 500, slug: 'kerevitas-dondurulmus-kofte-500g' },
  ];

  const createdProducts: Record<string, string> = {}; // slug -> id

  for (const def of productDefs) {
    // Mevcut urunu bul veya olustur
    let product = await prisma.product.findUnique({ where: { slug: def.slug } });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: def.name,
          brand: def.brand ?? null,
          categoryId: def.categoryId,
          unit: def.unit,
          unitValue: def.unitValue,
          slug: def.slug,
          isActive: true,
        },
      });
    } else {
      // Mevcut urunlerin alt kategoriye tasinmasi
      await prisma.product.update({
        where: { id: product.id },
        data: { categoryId: def.categoryId },
      });
    }

    // Barkod ekle (yoksa)
    await prisma.barcode.upsert({
      where: { code: def.barcode },
      update: {},
      create: {
        code: def.barcode,
        format: BarcodeFormat.EAN_13,
        productId: product.id,
      },
    });

    createdProducts[def.slug] = product.id;
  }

  console.log(`  ${productDefs.length} urun olusturuldu`);

  // =====================================================
  // 5. FİYATLAR (her ürün × her market)
  // Kuruş cinsinden — 29.90 TL = 2990 kuruş
  // =====================================================

  // Fiyat tablosu: productSlug -> { marketId -> kurusCinsindenFiyat }
  const markets = [migros, bim, a101, sok, carrefour];

  // Temel fiyatlar (Migros baz alindi, diger marketler varyasyon)
  const priceTable: Record<string, [number, number, number, number, number]> = {
    // [Migros, BIM, A101, SOK, CarrefourSA] — kuruş
    'pinar-tam-yaglis-sut-1lt':        [3490, 2990, 3190, 3090, 3390],
    'sek-yarim-yaglis-sut-1lt':        [3290, 2890, 2990, 2890, 3190],
    'sutas-beyaz-peynir-400g':         [8990, 7490, 7990, 7690, 8690],
    'pinar-kasar-peyniri-400g':        [9490, 8190, 8690, 8390, 9290],
    'danone-yogurt-500g':              [4490, 3890, 4090, 3990, 4390],
    'barilla-boru-makarna-500g':       [3990, 3490, 3690, 3590, 3890],
    'pastavilla-sehriye-500g':         [2990, 2490, 2690, 2590, 2890],
    'ulker-princ-1kg':                 [3490, 2990, 3190, 3090, 3390],
    'tukas-domates-salcasi-830g':      [5490, 4890, 5090, 4990, 5390],
    'komili-zeytinyagi-500ml':         [14990, 13490, 13990, 13690, 14790],
    'yudum-aycicek-yagi-1lt':          [6490, 5890, 6090, 5990, 6390],
    'torku-seker-1kg':                 [4490, 3990, 4190, 4090, 4390],
    'sokak-un-1kg':                    [2490, 1990, 2190, 2090, 2390],
    'erikli-kaynak-suyu-15lt':         [1990, 1690, 1790, 1690, 1890],
    'sira-maden-suyu-1lt':             [2490, 2190, 2290, 2190, 2390],
    'cappy-portakal-suyu-1lt':         [5990, 5390, 5590, 5490, 5890],
    'coca-cola-1lt':                   [3490, 3190, 3290, 3190, 3390],
    'caykur-cay-500g':                 [7990, 6990, 7290, 7190, 7790],
    'domates-1kg':                     [2490, 2090, 2190, 2090, 2390],
    'salatalik-1kg':                   [1990, 1690, 1790, 1690, 1890],
    'elma-1kg':                        [3490, 2990, 3190, 3090, 3390],
    'ulker-cikolatali-gofret-36g':     [1990, 1690, 1790, 1690, 1890],
    'lays-cips-orijinal-100g':         [2990, 2590, 2790, 2690, 2890],
    'ulker-biskuvi-82g':               [1290, 990, 1090, 1090, 1190],
    'ariel-camasir-deterjani-1kg':     [11990, 10490, 10990, 10690, 11790],
    'fairy-bulasik-deterjani-650ml':   [7490, 6490, 6990, 6790, 7290],
    'comfort-yumusatici-15lt':         [8990, 7990, 8290, 8090, 8790],
    'colgate-dis-macunu-75ml':         [2990, 2590, 2790, 2690, 2890],
    'hs-sampuan-250ml':                [6490, 5690, 5990, 5790, 6290],
    'bonduelle-dondurulmus-bezelye-400g': [4990, 4290, 4590, 4390, 4890],
    'kerevitas-dondurulmus-kofte-500g': [8490, 7490, 7890, 7690, 8290],
  };

  let priceCount = 0;
  for (const [slug, prices] of Object.entries(priceTable)) {
    const productId = createdProducts[slug];
    if (!productId) continue;

    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];
      const amount = prices[i];

      await prisma.price.upsert({
        where: { productId_marketId: { productId, marketId: market.id } },
        update: { amount, lastUpdated: new Date() },
        create: {
          productId,
          marketId: market.id,
          amount,
          currency: 'TRY',
          isAvailable: true,
          source: PriceSource.MANUAL_ADMIN,
        },
      });
      priceCount++;
    }
  }
  console.log(`  ${priceCount} fiyat kaydi olusturuldu`);
  KALDIRILDI */

  // =====================================================
  // 6. KATALOGLAR (2 aktif katalog)
  // =====================================================

  const now = new Date();
  // Aktif kataloglar 2 hafta geçerli — scraper gerçek tarihleri doldurur
  const catalogEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // NOT: Katalog sayfaları artık kimbino.com.tr scraper'ı tarafından doldurulur.
  // Seed sadece çiskelet katalog kaydı oluşturur; coverImageUrl + pageCount
  // backend başladığında veya admin "Scrape" butonuna basıldığında güncellenir.

  await prisma.catalog.upsert({
    where: { id: 'catalog-migros-haftalik' },
    update: { endDate: catalogEnd },
    create: {
      id: 'catalog-migros-haftalik',
      marketId: migros.id,
      title: 'Migros Haftalık İndirimler',
      description: 'Bu haftanın en iyi fırsatları Migros\'ta!',
      startDate: now,
      endDate: catalogEnd,
      pageCount: 0,
      isActive: true,
      scrapeSource: 'scraper',
    },
  });

  await prisma.catalog.upsert({
    where: { id: 'catalog-bim-aktuel' },
    update: { endDate: catalogEnd },
    create: {
      id: 'catalog-bim-aktuel',
      marketId: bim.id,
      title: 'BİM Aktüel Ürünler',
      description: 'BİM\'in bu haftaki aktüel ürün kataloğu',
      startDate: now,
      endDate: catalogEnd,
      pageCount: 0,
      isActive: true,
      scrapeSource: 'scraper',
    },
  });

  console.log('  2 katalog olusturuldu (sayfalar kimbino scraper tarafindan doldurulur)');

  // =====================================================
  // 7. ÖRNEK İHBARLAR (3 ihbar)
  // =====================================================

  const sütProduct = await prisma.product.findUnique({ where: { slug: 'pinar-tam-yaglis-sut-1lt' } });
  const peynirProduct = await prisma.product.findUnique({ where: { slug: 'sutas-beyaz-peynir-400g' } });

  const expiryYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const expiryLastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await prisma.report.upsert({
    where: { id: 'report-demo-001' },
    update: {},
    create: {
      id: 'report-demo-001',
      userId: normalUser.id,
      productId: sütProduct?.id ?? null,
      marketId: bim.id,
      description: 'Rafta tarihi geçmiş süt ürünleri var. Son kullanma tarihi dünü gösteren ürünler hâlâ satışta.',
      expiryDate: expiryYesterday,
      city: 'İstanbul',
      district: 'Üsküdar',
      status: ReportStatus.PENDING,
    },
  });

  await prisma.report.upsert({
    where: { id: 'report-demo-002' },
    update: {},
    create: {
      id: 'report-demo-002',
      userId: normalUser.id,
      productId: peynirProduct?.id ?? null,
      marketId: migros.id,
      description: 'Peynir reyonunda son kullanma tarihi 7 gün önce dolmuş ürün bulundu.',
      expiryDate: expiryLastWeek,
      city: 'İstanbul',
      district: 'Kadıköy',
      status: ReportStatus.UNDER_REVIEW,
      reviewedById: inspector.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.report.upsert({
    where: { id: 'report-demo-003' },
    update: {},
    create: {
      id: 'report-demo-003',
      isAnonymous: true,
      barcodeCode: '8690504011057',
      marketId: a101.id,
      description: 'Çikolatalı gofret ürününde son kullanma tarihi geçmiş birkaç adet mevcut.',
      expiryDate: expiryYesterday,
      city: 'İstanbul',
      district: 'Maltepe',
      status: ReportStatus.PENDING,
    },
  });

  console.log('  3 ornek ihbar olusturuldu');

  // =====================================================
  // TAMAMLANDI
  // =====================================================

  console.log('');
  console.log('=========================================');
  console.log('Seed tamamlandi!');
  console.log('');
  console.log('Giris bilgileri:');
  console.log('  Admin : admin@marketapp.com    / Admin123!');
  console.log('  Denetci: denetci@marketapp.com / Admin123!');
  console.log('  Kullanici: kullanici@marketapp.com / User123!');
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
