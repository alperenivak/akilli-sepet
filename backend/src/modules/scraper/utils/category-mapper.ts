// =====================================================
// Ürün adı + marka + Migros kategori verisi kullanarak
// sistemdeki doğru kategori slug'ını belirler.
// =====================================================

/** Kategori tespiti için yeterli eşik puanı */
const MIN_SCORE = 1;

/**
 * Türkçe karakterleri ve fazla boşlukları normalize eder, küçük harfe çevirir.
 * Arama/eşleştirme amacıyla kullanılır — görüntülemede kullanılmaz.
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

// ────────────────────────────────────────────────────────
// Migros API kategori adı → bizim slug
// ────────────────────────────────────────────────────────
const MIGROS_CATEGORY_MAP: Record<string, string> = {
  // Süt Ürünleri
  'sut': 'sut',
  'icsut': 'sut',
  'icme sutu': 'sut',
  'uht sut': 'sut',
  'pastorize sut': 'sut',
  'organik sut': 'sut',
  'keci sutu': 'sut',
  'sut & sut urunleri': 'sut-urunleri',
  'peynir': 'peynir',
  'beyaz peynir': 'peynir',
  'kasar peyniri': 'peynir',
  'kasar': 'peynir',
  'yogurt': 'yogurt',
  'yogurtlar': 'yogurt',
  'meyveli yogurt': 'yogurt',
  'ayran': 'yogurt',
  'kefir': 'yogurt',
  'tereyagi & margarin': 'yag-salca',
  'tereyagi': 'yag-salca',
  'siviyaglar': 'yag-salca',
  'sivi yaglar': 'yag-salca',
  'zeytinyagi': 'yag-salca',
  'salca & ketchap': 'yag-salca',
  'salca': 'yag-salca',
  // Et & Tavuk
  'et': 'kirmizi-et',
  'kirmizi et': 'kirmizi-et',
  'kiyma': 'kirmizi-et',
  'dana': 'kirmizi-et',
  'kuzu': 'kirmizi-et',
  'tavuk': 'tavuk',
  'pilic': 'tavuk',
  'hindi': 'tavuk',
  'sucuk & sosis': 'sarkuteri',
  'salam & sosis': 'sarkuteri',
  'sarkuteri': 'sarkuteri',
  'sarkulteri': 'sarkuteri',
  'pastirma': 'sarkuteri',
  // Meyve & Sebze
  'taze meyve': 'meyve',
  'meyve': 'meyve',
  'taze sebze': 'sebze',
  'sebze': 'sebze',
  // İçecekler
  'cay': 'cay-kahve',
  'siyah cay': 'cay-kahve',
  'bitki & meyve caylari': 'cay-kahve',
  'bitki cayi': 'cay-kahve',
  'kahve': 'cay-kahve',
  'turk kahvesi': 'cay-kahve',
  'hazir kahve': 'cay-kahve',
  'meyve suyu': 'meyve-suyu',
  'nektar': 'meyve-suyu',
  'nektarlar': 'meyve-suyu',
  'kaynak suyu': 'su-maden-suyu',
  'maden suyu': 'su-maden-suyu',
  'soda': 'su-maden-suyu',
  'kola & gazli icecekler': 'mesrubat',
  'mesrubat': 'mesrubat',
  'gazli icecek': 'mesrubat',
  'enerji iceceği': 'mesrubat',
  'enerji icecekleri': 'mesrubat',
  'ice tea': 'mesrubat',
  // Gıda
  'makarna': 'makarna-pirinc',
  'pirinc': 'makarna-pirinc',
  'bulgur & tahil': 'makarna-pirinc',
  'bulgur': 'makarna-pirinc',
  'kuru baklagiller': 'makarna-pirinc',
  'un & nisasta': 'un-seker',
  'un': 'un-seker',
  'seker': 'un-seker',
  'tuz & baharat': 'un-seker',
  'baharat': 'un-seker',
  // Temizlik
  'camasir deterjani': 'camasir',
  'camasir': 'camasir',
  'yumusatici': 'camasir',
  'leke cikarici': 'camasir',
  'bulasik': 'bulasik',
  'bulasik deterjani': 'bulasik',
  'bulasik makinesi': 'bulasik',
  'yuzey temizleyiciler': 'temizlik',
  'temizlik': 'temizlik',
  'kagit urunleri': 'temizlik',
  'cop torbalari': 'temizlik',
  'dezenfektan': 'temizlik',
  // Kişisel Bakım
  'dis & agiz bakimi': 'agiz-bakimi',
  'dis macunlari': 'agiz-bakimi',
  'dis fircasi': 'agiz-bakimi',
  'sampuan': 'sac-bakimi',
  'sac bakim': 'sac-bakimi',
  'kisisel bakim': 'kisisel-bakim',
  'vucut bakimi': 'kisisel-bakim',
  'dus jeli': 'kisisel-bakim',
  'sabun': 'kisisel-bakim',
  'deodorant': 'kisisel-bakim',
  'bebek urunleri': 'kisisel-bakim',
  // Dondurulmuş
  'dondurma': 'dondurulmus',
  'dondurulmus gida': 'dondurulmus',
  'dondurulmus sebze': 'dondurulmus-sebze',
  'dondurulmus et': 'dondurulmus-et',
  // Atıştırmalık
  'cikolata': 'cikolata-gofret',
  'gofret': 'cikolata-gofret',
  'seker & sakiz': 'cikolata-gofret',
  'biskuvi': 'biskuvi',
  'kraker': 'biskuvi',
  'kek': 'biskuvi',
  'cips & cerezler': 'cips',
  'cips': 'cips',
  'atistirmalik': 'atistirmalik',
};

// ────────────────────────────────────────────────────────
// Marka adı → kategori slug (yetkili marka eşleştirmesi)
// ────────────────────────────────────────────────────────
const BRAND_SLUG_MAP: Record<string, string> = {
  // Çamaşır
  ariel: 'camasir',
  persil: 'camasir',
  omo: 'camasir',
  ace: 'camasir',
  'bio presto': 'camasir',
  'yumoş': 'camasir',
  downy: 'camasir',
  vernel: 'camasir',
  bingo: 'camasir',
  alo: 'camasir',
  // Bulaşık
  pril: 'bulasik',
  fairy: 'bulasik',
  // Temizlik
  bref: 'temizlik',
  domestos: 'temizlik',
  cif: 'temizlik',
  'mr proper': 'temizlik',
  'mr. proper': 'temizlik',
  'mr muscle': 'temizlik',
  'mr. muscle': 'temizlik',
  dettol: 'temizlik',
  antikal: 'temizlik',
  evyap: 'temizlik',
  // Ağız Bakımı
  colgate: 'agiz-bakimi',
  'oral-b': 'agiz-bakimi',
  'oral b': 'agiz-bakimi',
  sensodyne: 'agiz-bakimi',
  elgydium: 'agiz-bakimi',
  // Saç Bakımı
  pantene: 'sac-bakimi',
  'head & shoulders': 'sac-bakimi',
  'head&shoulders': 'sac-bakimi',
  elvital: 'sac-bakimi',
  schwarzkopf: 'sac-bakimi',
  'garnier fructis': 'sac-bakimi',
  // Kişisel Bakım
  dove: 'kisisel-bakim',
  nivea: 'kisisel-bakim',
  gillette: 'kisisel-bakim',
  gilette: 'kisisel-bakim',
  rexona: 'kisisel-bakim',
  'fa': 'kisisel-bakim',
  // Dondurma
  algida: 'dondurulmus',
  magnum: 'dondurulmus',
  cornetto: 'dondurulmus',
  'carte d\'or': 'dondurulmus',
  'max twister': 'dondurulmus',
  // Çikolata
  milka: 'cikolata-gofret',
  toblerone: 'cikolata-gofret',
  lindt: 'cikolata-gofret',
  ferrero: 'cikolata-gofret',
  raffaello: 'cikolata-gofret',
  kinder: 'cikolata-gofret',
  nutella: 'cikolata-gofret',
  nestle: 'cikolata-gofret',
  m_m: 'cikolata-gofret',
  haribo: 'cikolata-gofret',
  // İçecekler
  'coca-cola': 'mesrubat',
  'cocacola': 'mesrubat',
  pepsi: 'mesrubat',
  fanta: 'mesrubat',
  sprite: 'mesrubat',
  'red bull': 'mesrubat',
  redbull: 'mesrubat',
  monster: 'mesrubat',
  arizona: 'mesrubat',
  'black bruin': 'mesrubat',
  // Çamaşır (Calgon çamaşır makinesi kireç önleyici)
  calgon: 'camasir',
  // Kahve
  nescafe: 'cay-kahve',
  nes: 'cay-kahve',
  tchibo: 'cay-kahve',
  lavazza: 'cay-kahve',
  'lipton': 'cay-kahve',
  dogadan: 'cay-kahve',
  'doğadan': 'cay-kahve',
  caykur: 'cay-kahve',
  'çaykur': 'cay-kahve',
};

// ────────────────────────────────────────────────────────
// Kelime/cümle örüntüleri → kategori slug
// (sıra önemli — spesifik eşleşmeler önce gelir)
// ────────────────────────────────────────────────────────
const KEYWORD_RULES: Array<{ patterns: RegExp[]; slug: string }> = [
  // --- Temizlik ürünleri (ÖNCE kontrol et, yanlış gıda atamasını engelle) ---
  {
    patterns: [
      /camasir deterjan/, /camasir suyu/, /yumusatici/, /leke cikarici/,
      /\bariel\b/, /\bpersil\b/, /\bomo\b/, /\bace\b(?! bandaj)/, /\byumos\b/,
    ],
    slug: 'camasir',
  },
  {
    patterns: [
      /bulasik/, /\bpril\b/, /\bfairy\b/, /parlatici/, /dishwash/,
    ],
    slug: 'bulasik',
  },
  {
    patterns: [
      /\bbref\b/, /\bdomestos\b/, /\bcif\b(?! gr)/, /dezenfektan/,
      /wc temiz/, /yuzey temizl/, /tuvalet temizl/, /cok amacli temizl/,
      /kagit havlu/, /tuvalet kagidi/, /islak mendil/, /cop poseti/, /cop torbas/,
      /\bdettol\b/, /antibakteri/, /antiseptik/, /hijyen/,
      /bocek ilaci/, /hasereilaci/, /bocek/, /rodentisit/,
      /kirec onleyici/, /makine temizl/,
    ],
    slug: 'temizlik',
  },
  // --- Kişisel Bakım ---
  {
    patterns: [
      /dis macunu/, /dis fircasi/, /agiz suyu/, /dis ipi/, /\bcolgate\b/,
      /\boral.?b\b/, /\bsensodyne\b/,
    ],
    slug: 'agiz-bakimi',
  },
  {
    patterns: [
      /sampuan/, /sac kremi/, /sac bakim/, /sac yagi/, /kepek/,
      /sac maskesi/, /\bpantene\b/, /head.?shoulders/, /\belvital\b/,
      /\bschwarzkopf\b/,
    ],
    slug: 'sac-bakimi',
  },
  {
    patterns: [
      /dus jeli/, /vucut sampuani/, /deodorant/, /antiperspirant/,
      /gunes kremi/, /nemlendirici/, /el kremi/, /vucut losyon/,
      /tiras kopugu/, /\bnivea\b/, /\bdove\b(?! cikolata)/, /\bgillette\b/,
      /\bgilette\b/, /\brexona\b/, /parfum/, /kolonya/, /bebek bezi/,
      /bebek sampuani/, /bebek losyon/, /sac duzlestiric/, /epilasyon/,
      /maske.*yuz/, /yuz kremi/,
      // sabun: sıvı deterjan, sabun karası ile karışmasın
      /\bsabun\b(?!.*deterjan)(?!.*karasi)(?!.*toz)/,
      /\bbanyo\b.*lif/, /tirnak makas/, /makyaj/, /micellar/,
      /temizleme.*suyu(?!.*cok)/, /vucut losyon/, /dudak/, /\bruj\b/,
      // krem: yalnızca kişisel bakım kremleri — gıda "kremalı"sı değil
      /vucut kremi/, /el kremi/, /yuz kremi/, /\bnasil kremi\b/,
      // "losyon" gıda kontekstinde de geçmez ama emin olalım
      /\blosyon\b(?!.*sivi)/,
    ],
    slug: 'kisisel-bakim',
  },
  // --- Dondurulmuş ---
  {
    patterns: [
      /dondurulmus sebze/, /donmus bezelye/, /donmus brokoli/, /donmus misir/,
      /donmus ispanak/,
    ],
    slug: 'dondurulmus-sebze',
  },
  {
    patterns: [
      /\bdondurma\b/, /\balgida\b/, /\bmagnum\b/, /carte d.or/,
      /\bkornet\b(?!.*kagit)/, /\bmaras cup\b/, /\bkahramanmaras\b.*dondurma/,
    ],
    slug: 'dondurulmus',
  },
  {
    patterns: [
      /dondurulmus/, /\bdonmus\b/,
    ],
    slug: 'dondurulmus-et',
  },
  // --- Atıştırmalık ---
  {
    patterns: [
      /\bcikolata\b/, /\bgofret\b/, /\bbonbon\b/, /pralin/, /truf/,
      /\bkinder\b/, /\bmilka\b/, /\btoblerone\b/, /\blindt\b/,
      /\bferrero\b/, /\braffaello\b/, /\bnutella\b/, /\bharibo\b/,
      /sekerleme/, /karamela(?!.*sut)/, /\blokum\b/,
    ],
    slug: 'cikolata-gofret',
  },
  {
    patterns: [
      /\bcips\b/, /patates cipsi/, /misir cipsi/, /\bpopcorn\b/,
      /\blays\b/, /lay.s\b/, /\bpringles\b/, /\bpopkorn\b/,
    ],
    slug: 'cips',
  },
  {
    patterns: [
      /\bbiskuvi\b/, /\bkurabiye\b/, /\bgaleta\b/, /\bkraker\b/,
      /\bwafer\b/, /rulo kek/, /petit beurre/, /\bgrisini\b/,
      /\bkeks\b/, /\bpandispanya\b/,
    ],
    slug: 'biskuvi',
  },
  // --- Meyve & Sebze ---
  {
    patterns: [
      /\belma\b(?!.*suyu)(?!.*aromali)/, /\barmut\b(?!.*aromali)/,
      /\bportakal\b(?!.*suyu)(?!.*aromali)/, /\bmandalina\b/,
      /\blimon\b(?!.*suyu)(?!.*aromali)/, /\bmuz\b(?!.*aromali)(?!.*sutlu)(?!.*sut)/,
      /\bcilek\b(?!.*aromali)/, /\bkiraz\b(?!.*aromali)/,
      /\bkayisi\b(?!.*aromali)/, /\bseftali\b(?!.*aromali)/,
      /\buzum\b/, /\bkivi\b/, /\bmango\b/, /\bananas\b/,
      /\bkavun\b/, /\bkarpuz\b/, /\bnar\b(?! cam)/,
      /\bavokado\b/, /taze meyve/,
    ],
    slug: 'meyve',
  },
  {
    patterns: [
      /\bdomates\b(?!.*salca)(?!.*ketc)/, /\bsalatalik\b/, /\bbiber\b(?!.*salca)(?!.*sos)/,
      /\bpatlican\b/, /\bkabak\b/, /\bispanak\b/, /\bmaydanoz\b/,
      /\bsogan\b(?!.*tozu)/, /\bsarimsak\b(?!.*tozu)/, /\bpatates\b(?!.*cips)(?!.*pure)/,
      /\bhavuc\b/, /\bpirasa\b/, /\bmarul\b/, /\bbrokoli\b/, /\bkarnabahar\b/,
      /taze sebze/, /\broka\b/, /\bsemizotu\b/, /\benginar\b/,
    ],
    slug: 'sebze',
  },
  // --- Süt Ürünleri ---
  {
    // yogurt + Türkçe ek (-u, -a, -da) — trailing \b kaldırıldı
    patterns: [
      /yogurt/, /\bayran\b/, /\bkefir\b/, /meyveli yogurt/,
      /\bpuding\b/, /\bmuhallebi\b/, /\bsutlac\b/,
    ],
    slug: 'yogurt',
  },
  {
    patterns: [
      // "peynir" + Türkçe ek (-i, -e, -de, vb.) — \b yerine /peynir/ kullan
      /peynir/, /\bkasar\b/, /beyaz peynir/, /dil peyniri/,
      /orgu peyniri/, /\bcecil\b/, /\btulum\b(?!.*sarkuteri)/,
      /\blor\b(?! sarap)/, /\bricotta\b/, /mozzarella/, /\bhellim\b/,
      /grana padano/, /\blabne\b/, /ezine.*peynir/, /\bparmesan\b/,
      /gravyer/, /\bbrie\b/, /\bcamembert\b/, /\bgouda\b/,
      /\bmascarpon/, /\bdanish blue\b/,
    ],
    slug: 'peynir',
  },
  {
    patterns: [
      /\bsut\b(?!\s*urunleri)/, /\buht\b.*sut/, /pastorize.*sut/,
      /organik sut/, /keci sutu/, /soya.*icecek/, /badem.*icecek/,
      /yulaf.*icecek/, /bitkisel.*icecek.*sut/,
      // İnek sütü özel formlar - "sütlü kahve", "sütlü çikolata" ile karışmasın
      /\binek sutu\b/,
      /sutlu\b(?!.*kahve)(?!.*cikolata)(?!.*latte)(?!.*menengi)(?!.*krema)(?!.*cikol)/,
    ],
    slug: 'sut',
  },
  // --- Et & Tavuk ---
  {
    patterns: [
      /\btavuk\b/, /\bpilic\b/, /\bhindi\b(?!.*bisküvi)/, /\bbroiler\b/,
    ],
    slug: 'tavuk',
  },
  {
    patterns: [
      /\bsucuk\b/, /\bsalam\b(?!.*sarkuteri)/, /\bsosis\b/,
      /\bpastirma\b/, /\bjambon\b/, /\bfume\b(?!.*su)/, /\bkavurma\b/,
    ],
    slug: 'sarkuteri',
  },
  {
    patterns: [
      /\bkiyma\b/, /\bdana\b(?!.*peynir)(?!.*tereyagi)/,
      /\bkuzu\b(?!.*seker)/, /\bbiftek\b/, /\bantrikot\b/,
      /\bbonfile\b/, /\bpirzola\b/, /kusbaşı/, /kusbasi/,
    ],
    slug: 'kirmizi-et',
  },
  // --- İçecekler ---
  {
    patterns: [
      /\bcay\b(?!.*kasesi)/, /\bsiyah cay\b/, /bitki cayi/, /meyve cayi/,
      /\bkahve\b/, /\bnescafe\b/, /turk kahvesi/, /\bespresso\b/,
      /\bsalep\b/, /\bhazir kahve\b/, /\btchibo\b/, /\blavazza\b/,
      /\blipton\b/, /\bdogadan\b/, /\bcaykur\b/,
    ],
    slug: 'cay-kahve',
  },
  {
    patterns: [
      /meyve suyu/, /meyve nektari/, /\bnektar\b/, /portakal suyu/,
      /elma suyu/, /visne suyu/, /multivitamin suyu/,
    ],
    slug: 'meyve-suyu',
  },
  {
    patterns: [
      /\bkola\b/, /\bgazoz\b/, /\bfanta\b/, /\bsprite\b/, /\bpepsi\b/,
      /enerji icecegi/, /ice tea/, /\blimonata\b(?!.*meyve)/,
      /\bcoca.cola\b/, /gazli icecek/,
      // Aromalı/meyve aromalı içecek (meyve suyu değil)
      /aromali icecek/, /aromalı icecek/, /icecek.*ml\b/,
    ],
    slug: 'mesrubat',
  },
  {
    patterns: [
      /maden suyu/, /\bsoda\b(?!.*deterjan)/, /mineralli su/,
      /kaynak suyu/, /\bassu\b/, /\bdamla\b(?!.*kulak)/,
      /\bdamlisu\b/, /\bsariyer\b.*su/, /\bpinar\b.*su/,
      /\bbeypazari\b/, /\bkivircik\b.*su/,
    ],
    slug: 'su-maden-suyu',
  },
  // --- Gıda Alt Kategorileri ---
  {
    patterns: [
      /\bmakarna\b/, /\bspagetti\b/, /\bpenne\b/, /\bfusilli\b/,
      /\beriste\b/, /\bnoodle\b/, /\bpirinc\b(?!.*puding)/,
      /\bbulgur\b/, /\bkuskus\b/, /mercimek(?! corbasi)/, /\bnohut\b/,
      /kuru fasulye/, /\bbasmati\b/,
    ],
    slug: 'makarna-pirinc',
  },
  {
    patterns: [
      /zeytinyagi/, /aycicek yagi/, /misirozu yagi/, /findik yagi/,
      /hindistancevizi yagi/, /\bmargarin\b/, /\btereyag/, /\bsalca\b/,
      /\bketcap\b/, /ketcap/, /\bsoya sosu\b/,
    ],
    slug: 'yag-salca',
  },
  {
    patterns: [
      /\bun\b.*\d+\s*(kg|g)\b/, /\bun\b(?!.*unu)(?!.*bun)(?!.*sun)/,
      /\bseker\b(?!.*sekerleme)(?!.*limon)/, /\bnisasta\b/,
      /kabartma tozu/, /\bmaya\b(?!.*bira)(?!.*kahve)/,
      /\btuz\b(?!.*tuzlu)(?!.*tuzlanm)/, /\bbaharat\b/,
      /karabiber/, /\btarcin\b/, /\bvanilya\b(?!.*muhallebi)/,
      /\bkori\b/, /\bzerdecal\b/, /kimyon/,
    ],
    slug: 'un-seker',
  },
];

// ────────────────────────────────────────────────────────
// Ana fonksiyon
// ────────────────────────────────────────────────────────

/**
 * Ürün adı, marka ve Migros kategori bilgisini kullanarak
 * sistemdeki doğru kategori slug'ını döner.
 *
 * @param productName  Ürün adı
 * @param brand        Marka adı (opsiyonel)
 * @param migrosCategory  Migros'tan gelen kategori adı (opsiyonel)
 * @param migrosParents   Migros üst kategorileri (opsiyonel)
 * @returns  Kategori slug veya null (belirlenemedi)
 */
export function mapProductToCategory(
  productName: string,
  brand?: string | null,
  migrosCategory?: string | null,
  migrosParents?: string[],
): string | null {
  const normName = normalizeForMatch(productName);
  const normBrand = brand ? normalizeForMatch(brand) : null;

  // 1. Migros kategori adından doğrudan eşleştir (en güvenilir)
  if (migrosCategory) {
    const normMigros = normalizeForMatch(migrosCategory);
    const directSlug = MIGROS_CATEGORY_MAP[normMigros];
    if (directSlug) return directSlug;

    // Kısmi eşleştirme (Migros kategorisi bir anahtar kelime içeriyorsa)
    for (const [key, slug] of Object.entries(MIGROS_CATEGORY_MAP)) {
      if (normMigros.includes(key) || key.includes(normMigros)) {
        return slug;
      }
    }
  }

  // Migros üst kategorilerini de dene
  if (migrosParents?.length) {
    for (const parent of migrosParents) {
      const normParent = normalizeForMatch(parent);
      const slug = MIGROS_CATEGORY_MAP[normParent];
      if (slug) return slug;
    }
  }

  // 2. Marka adından belirle (yetkili marka → kategori tablosu)
  if (normBrand) {
    const brandSlug = BRAND_SLUG_MAP[normBrand];
    if (brandSlug) return brandSlug;

    // Kısmi marka eşleştirme — sadece 4+ karakter olan anahtarlar, tam kelime sınırı ile
    for (const [brandKey, slug] of Object.entries(BRAND_SLUG_MAP)) {
      if (brandKey.length >= 4) {
        // normBrand'in içinde tam kelime olarak brandKey geçiyor mu?
        const rx = new RegExp(`\\b${brandKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (rx.test(normBrand)) return slug;
      } else if (normBrand === brandKey) {
        return slug;
      }
    }
  }

  // 3. Ürün adından keyword eşleştirme
  for (const rule of KEYWORD_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normName)) {
        return rule.slug;
      }
    }
  }

  // Belirlenemedi
  return null;
}

/**
 * Kategori slug'ını önce alt kategori olarak arar,
 * yoksa üst kategori olarak arar, onu da bulamazsa
 * 'gida' üst kategorisine düşer.
 */
export async function resolveCategoryId(
  prisma: {
    category: {
      findFirst: (args: {
        where: { slug?: string; isActive?: boolean };
        orderBy?: { sortOrder?: 'asc' | 'desc' };
      }) => Promise<{ id: string } | null>;
    };
  },
  slug: string | null,
): Promise<string> {
  if (slug) {
    const cat = await prisma.category.findFirst({
      where: { slug, isActive: true },
    });
    if (cat) return cat.id;
  }

  // Fallback: gıda üst kategorisi
  const fallback = await prisma.category.findFirst({
    where: { slug: 'gida', isActive: true },
  });
  if (fallback) return fallback.id;

  // Son çare: herhangi bir aktif kategori
  const any = await prisma.category.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (!any) throw new Error('Sistemde hiç aktif kategori bulunamadı');
  return any.id;
}
