// =====================================================
// Kategori Sınıflandırıcı — Türkçe Anahtar Kelime Kuralları
// Tüm kurallar öncelik sırasına göre sıralıdır (daha spesifik önce)
// =====================================================

export interface ClassificationRule {
  slug: string;
  patterns: RegExp[];
}

/**
 * Kural listesi: ilk eşleşen kazanır.
 * Alt kategoriler (Ağız Bakımı, Yoğurt, Peynir vb.) üst kategorilerden (Kişisel Bakım, Süt Ürünleri)
 * önce tanımlanmıştır.
 */
export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ──────────────────────────── Ağız Bakımı ─────────────────────────────
  {
    slug: 'agiz-bakimi',
    patterns: [
      /diş macunu/i, /diş fırça/i, /ağız gargar/i, /diş ipi/i,
      /\bgargara\b/i, /diş köpü/i, /diş beyazlatıcı/i,
      /\bcolgate\b/i, /\bsensodyne\b/i, /\boral.?b\b/i, /\bsignal\b.*diş/i,
      /\brocs\b.*diş/i, /\bblendamed\b/i,
    ],
  },
  // ──────────────────────────── Saç Bakımı ──────────────────────────────
  {
    slug: 'sac-bakimi',
    patterns: [
      /\bşampuan\b/i,
      /saç (kremi|bakım|maskesi|köpü|spreyi|yağı|boyası|serumu)/i,
      /head\s*&?\s*shoulders/i, /\bpantene\b.*saç/i,
      /\belvive\b/i, /\bclear\b.*şampuan/i,
    ],
  },
  // ──────────────────────────── Bulaşık ─────────────────────────────────
  {
    slug: 'bulasik',
    patterns: [
      /bulaşık\s*(deterjan|sıvı|tablet|jel|makine)/i,
      /\bpril\b/i,
      /\bfairy\b.*bulaşık/i,
      /\bfinish\b.*(tablet|parlatıcı|tuz)/i,
    ],
  },
  // ──────────────────────────── Çamaşır ─────────────────────────────────
  {
    slug: 'camasir',
    patterns: [
      /çamaşır\s*(deterjan|sıvı|kapsül|tozu|suyu|parfüm|jel)/i,
      /\byumuşatıcı\b/i,
      /\bcomfort\b.*(yumuşatıcı|çamaşır)/i,
      /\blenor\b/i, /\bvernel\b/i,
      /\bomo\b.*(deterjan|çamaşır)/i,
      /\bpersil\b.*(deterjan|çamaşır)/i,
      /\bariel\b.*(deterjan|çamaşır)/i,
      /\bsurf\b.*(deterjan|çamaşır)/i,
    ],
  },
  // ──────────────────────────── Temizlik ────────────────────────────────
  {
    slug: 'temizlik',
    patterns: [
      /tuvalet kağıdı/i, /tuvalet kagıdı/i, /tuvalet kag/i,
      /kağıt havlu/i, /kagit havlu/i,
      /peçete/i, /pecete/i,
      /ıslak (mendil|tuvalet)/i, /islak mendil/i,
      /selpak/i, /papia/i, /familia/i, /solo.*(kağıt|tuvalet)/i,
      /mendil/i,
      /çöp (torba|poşet)/i, /çöp torbası/i,
      /yüzey temizleyici/i, /yüzey spreyi/i,
      /wc\s*(taş|jel|bl)/i, /klozet/i,
      /temizleyici (sprey|jel)/i,
      /kireç çözücü/i, /yağ çözücü/i,
      /dezenfektan/i, /kolonya/i,
      /el dezenfektan/i,
      /domestos/i, /glorix/i, /viakal/i, /cillit/i,
      /bingo.*(temizlik|çamaşır)/i,
      / deterjan /i, /toz deterjan/i, /deterjanı/i,
    ],
  },
  // ──────────────────────────── Kişisel Bakım ───────────────────────────
  {
    slug: 'kisisel-bakim',
    patterns: [
      /duş jeli/i, /vücut losyon/i, /vücut (kremi|yağı)/i,
      /\bdeodorant\b/i, /\bantiperspirant\b/i,
      /el kremi/i, /el losyon/i,
      /yüz (kremi|yıkama|maskesi|temizleyici)/i,
      /cilt (kremi|bakım|serumu|temizleyici)/i,
      /güneş (kremi|koruyucu)/i,
      /after shave/i, /tıraş (köpü|jel|bıçağı|kremi)/i,
      /\bnemlendirici\b/i, /\bmisel(ar)? su\b/i,
      /köpük sabun/i, /\bsıvı sabun\b/i, /\bel sabunu\b/i,
      /\bdove\b/i, /\bnivea\b/i, /\bbioderma\b/i,
      /\bgarnier\b/i, /\bvichy\b/i, /\bneutrogena\b/i,
      /\brexona\b/i, /\bgilette\b/i, /\bpersil\b.*el/i,
    ],
  },
  // ──────────────────────────── Su & Maden Suyu ─────────────────────────
  {
    slug: 'su-maden-suyu',
    patterns: [
      /maden suyu/i, /\bsoda\b/i,
      /doğal kaynak suyu/i, /içme suyu/i, /kaynak suyu/i,
      /\bdamacana\b/i,
      /\babant\b.*(su|su$)/i, /\bdamla\b.*(su|su$)/i,
      /\bçeşme\b.*su/i,
      /\bsu\b\s+\d+\s*(ml|lt|l\b)/i,
    ],
  },
  // ──────────────────────────── Çay & Kahve ─────────────────────────────
  {
    slug: 'cay-kahve',
    patterns: [
      / çay /i, /çayı/i, /çaylar/i,
      / kahve/i, /kahvesi/i, /kahveyi/i,
      /nescafe/i, /nescafé/i,
      /espresso/i, /cappuccino/i, / latte /i,
      /bitki çayı/i, /ıhlamur/i, /papatya çay/i,
      /adaçayı/i, /yeşil çay/i, /siyah çay/i,
      /türk kahves/i, /filtre kahve/i,
      /çaykur/i, /doğadan/i, /dogadan/i,
      /lipton/i, /jacobs/i, /nespresso/i,
    ],
  },
  // ──────────────────────────── Meyve Suyu ──────────────────────────────
  {
    slug: 'meyve-suyu',
    patterns: [
      /meyve suyu/i, /portakal suyu/i, /elma suyu/i,
      /domates suyu/i, /\bnektar(ı)?\b/i,
      /\bcappy\b/i, /\btampico\b/i,
      /\bpınar\b.*meyve/i, /\bdimes\b/i,
    ],
  },
  // ──────────────────────────── Meşrubat ────────────────────────────────
  {
    slug: 'mesrubat',
    patterns: [
      /\bkola\b/i, /\bfanta\b/i, /\bsprite\b/i, /\bpepsi\b/i,
      /\bschweppes\b/i, /\blimonata\b/i,
      /\bice tea\b/i, /\bicetea\b/i, /buzlu çay/i,
      /enerji içeceği/i, /\bredbull\b/i, /\bmonster\b.*ml/i,
      /\byedigün\b/i, /\bfruko\b/i,
      /\bcoca.?cola\b/i, /\b7up\b/i,
    ],
  },
  // ──────────────────────────── Süt ─────────────────────────────────────
  {
    slug: 'sut',
    patterns: [
      /(tam yağlı|yarım yağlı|yağsız|laktozsuz)\s*süt/i,
      /süt\s*(tam yağlı|yarım yağlı|yağsız|laktozsuz)/i,
      /\buht\b.*süt/i,
      /soya sütü/i, /badem sütü/i, /yulaf sütü/i,
      /\bsüt\b\s+\d+\s*(ml|lt|l\b)/i,
    ],
  },
  // ──────────────────────────── Yoğurt ──────────────────────────────────
  {
    slug: 'yogurt',
    patterns: [
      /\byoğurt\b/i, /süzme yoğurt/i,
      /\bayran\b/i, /\bkefir\b/i, /\bskyr\b/i,
      /\bactivia\b/i,
    ],
  },
  // ──────────────────────────── Peynir ──────────────────────────────────
  {
    slug: 'peynir',
    patterns: [
      /\bpeynir\b/i, /\bkaşar\b/i, /\bcheddar\b/i,
      /\bmozzarella\b/i, /\bparmesan\b/i,
      /\btulum\b.*peynir/i, /\blor\b.*peynir/i,
      /\bçökelek\b/i, /\blabne\b/i, /krem peynir/i,
      /\bricotta\b/i, /\brokfor\b/i,
      /beyaz peynir/i, /taze peynir/i, /otlu peynir/i,
      /\bgravyer\b/i,
    ],
  },
  // ──────────────────────────── Kırmızı Et ──────────────────────────────
  {
    slug: 'kirmizi-et',
    patterns: [
      /\bkıyma\b/i, /dana kıyma/i, /kuzu kıyma/i,
      /\bbiftek\b/i, /\bpirzola\b/i, /\bantrikot\b/i,
      /\bbonfile\b/i, /kontrafile/i, /kontrefilet/i,
      /\bsakatat\b/i, /kuzu but/i, /kuzu kol/i,
      /dana but/i, /\bkaburga\b/i,
    ],
  },
  // ──────────────────────────── Tavuk ───────────────────────────────────
  {
    slug: 'tavuk',
    patterns: [
      /\btavuk\b/i, /\bpiliç\b/i, /\bhindi\b/i,
      /\bnugget\b/i,
      /tavuk (but|göğüs|kanat|fileto)/i,
      /piliç (but|göğüs|kanat)/i,
    ],
  },
  // ──────────────────────────── Şarküteri ───────────────────────────────
  {
    slug: 'sarkuteri',
    patterns: [
      /\bsucuk\b/i, /\bsalam\b/i, /\bsosis\b/i,
      /\bpastırma\b/i, /\bjambon\b/i, /\bbacon\b/i,
      /\bfüme\b.*(et|tavuk|somon)/i,
    ],
  },
  // ──────────────────────────── Dondurulmuş Et ──────────────────────────
  {
    slug: 'dondurulmus-et',
    patterns: [/dondurulmuş.*(tavuk|köfte|et|pirzola|kanat)/i],
  },
  // ──────────────────────────── Dondurulmuş Sebze ───────────────────────
  {
    slug: 'dondurulmus-sebze',
    patterns: [/dondurulmuş.*(bezelye|mısır|sebze|brokoli|ıspanak)/i],
  },
  // ──────────────────────────── Dondurulmuş (genel) ─────────────────────
  {
    slug: 'dondurulmus',
    patterns: [
      /\bdondurulmuş\b/i, /\bdonmuş\b/i, /\bfrozen\b/i,
      /\bdondurma\b/i,
    ],
  },
  // ──────────────────────────── Çikolata & Gofret ───────────────────────
  {
    slug: 'cikolata-gofret',
    patterns: [
      /\bçikolata\b/i, /\bgofret\b/i, /\btruffle\b/i,
      /\bmilka\b/i, /\btoblerone\b/i, /\bkitkat\b/i,
      /\bsnickers\b/i, /\bbounty\b/i, /\btwix\b/i,
      /\bkinder\b/i, /\braffaello\b/i, /\bnutella\b/i,
      /fındık kreması/i, /\bpralin\b/i,
    ],
  },
  // ──────────────────────────── Bisküvi ─────────────────────────────────
  {
    slug: 'biskuvi',
    patterns: [
      /\bbisküvi\b/i, /\boreo\b/i, /petit beurre/i,
      /yulaflı.*bisküvi/i, /simit kraker/i,
    ],
  },
  // ──────────────────────────── Cips ────────────────────────────────────
  {
    slug: 'cips',
    patterns: [
      /\bcips\b/i, /\bçips\b/i,
      /\blays\b/i, /\bruffles\b/i, /\bdoritos\b/i,
      /\bcheetos\b/i, /\bpringles\b/i,
    ],
  },
  // ──────────────────────────── Atıştırmalık ────────────────────────────
  {
    slug: 'atistirmalik',
    patterns: [
      /\bkraker\b/i, /\bpopcorn\b/i, /mısır çekirdeği/i,
      /\bçekirdek\b/i, /\bfıstık\b/i, /\bkuruyemiş\b/i,
      /\bbadem\b/i, /\bceviz\b/i, /\bfındık\b/i,
      /\bleblebi\b/i, /antep fıstığı/i, /\bkaju\b/i,
    ],
  },
  // ──────────────────────────── Makarna & Pirinç ────────────────────────
  {
    slug: 'makarna-pirinc',
    patterns: [
      /\bmakarna\b/i, /\bspagetti\b/i, /\bspaghetti\b/i,
      /\bpenne\b/i, /\bfusilli\b/i, /\bfarfalle\b/i,
      /\bpirinç\b/i, /\bbulgur\b/i, /\bşehriye\b/i,
      /\berişte\b/i, /\blazanya\b/i,
    ],
  },
  // ──────────────────────────── Un & Şeker ──────────────────────────────
  {
    slug: 'un-seker',
    patterns: [
      /\bbuğday unu\b/i, /\bmısır unu\b/i, /\bun\s+\d+\s*kg/i,
      /pudra şekeri/i, /kesme şeker/i, /toz şeker/i,
      /kabartma tozu/i, /\bkarbonat\b/i,
      /\bnişasta\b/i, /vanilya şekeri/i,
    ],
  },
  // ──────────────────────────── Yağ & Salça ─────────────────────────────
  {
    slug: 'yag-salca',
    patterns: [
      /zeytinyağı/i, /ayçiçek yağ/i, /mısırözü yağ/i,
      /kanola yağ/i, /sızma.*yağ/i, /naturel.*yağ/i,
      / salça/i, /domates salça/i, /biber salça/i,
      /margarin/i, /bitkisel yağ/i,
    ],
  },
  // ──────────────────────────── Süt Ürünleri (tereyağı, kaymak) ─────────
  {
    slug: 'sut-urunleri',
    patterns: [
      /\btereyağ/i, /\bkaymak\b/i, /\bkrema\b/i,
    ],
  },
  // ──────────────────────────── Meyve ───────────────────────────────────
  {
    slug: 'meyve',
    patterns: [
      / elma /i, /elmalar/i, / portakal /i, / muz /i,
      /mandalina/i, / limon /i, / kivi /i,
      /çilek/i, / kavun /i, / karpuz /i,
      /üzüm/i, / armut /i, /şeftali/i,
      / kiraz /i, /vişne/i, / nar /i,
      / erik /i, / incir /i, /avokado/i,
      / mango /i, /ananas/i, /greyfurt/i,
    ],
  },
  // ──────────────────────────── Sebze ───────────────────────────────────
  {
    slug: 'sebze',
    patterns: [
      /domates/i, /salatalık/i, /patates/i,
      / soğan /i, /sarımsak/i, /pırasa/i,
      / havuç /i, /kereviz/i, / pancar /i,
      / kabak /i, /patlıcan/i, / biber /i,
      / mantar /i, /brokoli/i, /karnabahar/i,
      / bezelye/i, /lahana/i, /marul/i,
      / roka /i, /ıspanak/i, /maydanoz/i,
      /dereotu/i, / nane /i,
    ],
  },
  // ──────────────────────────── İçecekler (genel) ───────────────────────
  {
    slug: 'icecekler',
    patterns: [/\bşerbet\b/i, /\bkomposto\b/i, /malt içeceği/i],
  },
];

/**
 * Ürün adı ve marka bilgisine göre en uygun kategori slug'ını döndürür.
 * Eşleşme bulunamazsa null döner (mevcut kategori korunur).
 *
 * NOT: Türkçe karakterler (\b sınırı çalışmaz) sorununu önlemek için
 * metin baş ve sonuna boşluk eklenerek `/pattern/i` kalıpları güvenli şekilde çalışır.
 */
export function classifyProduct(name: string, brand = ''): string | null {
  // Boşluk eklenerek \b yerine " pattern " eşleşmesi güvenli hale gelir
  const text = ` ${name} ${brand} `.toLowerCase();
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return rule.slug;
    }
  }
  return null;
}
