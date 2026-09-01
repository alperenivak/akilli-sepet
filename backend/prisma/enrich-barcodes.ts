// =====================================================
// Akıllı Sepet — Barcode Enrichment Pipeline v2
// =====================================================
// Barkodsuz ürünlere çok kaynaklı, güven skorlu barkod ataması.
//
// Kaynaklar (güven sırası):
//   1. Manuel curated  (manual-barcodes.json) — güven: 1.00
//   2. Open Food Facts Search-a-licious API   — güven: 0.80
//
// Kullanım:
//   npm run seed:barcodes -- --dry-run
//   npm run seed:barcodes -- --limit 200 --min-confidence 0.72
//   npm run seed:barcodes -- --source manual --dry-run
//   npm run seed:barcodes -- --source all --write-report
//   npm run seed:barcodes -- --manual --dry-run
//   DATABASE_URL="postgresql://..." npm run seed:barcodes -- --limit 200 --dry-run
// =====================================================

import { PrismaClient, BarcodeFormat } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ── Dizin sabitleri ───────────────────────────────────
const DATA_DIR    = path.join(__dirname, 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const MANUAL_FILE = path.join(DATA_DIR, 'manual-barcodes.json');

// ── CLI argüman parse ─────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const get  = (flag: string, def: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : def;
  };
  const source = get('--source', 'all').toLowerCase();
  return {
    limit:              parseInt(get('--limit',          '200'), 10),
    dryRun:             args.includes('--dry-run'),
    minConfidence:      parseFloat(get('--min-confidence', '0.72')),
    source,                                          // 'all' | 'openfoodfacts' | 'manual'
    onlyPricedProducts: !args.includes('--all-products'),
    delayMs:            parseInt(get('--delay-ms',     '5000'), 10),
    writeReport:        args.includes('--write-report'),
    useManual:          args.includes('--manual') || source === 'all' || source === 'manual',
    useOFF:             source === 'all' || source === 'openfoodfacts',
  };
}

// ─────────────────────────────────────────────────────
// BÖLÜM 1: Yardımcı fonksiyonlar
// ─────────────────────────────────────────────────────

// Türkçe → ASCII normalizasyon
const TR_MAP: Record<string, string> = {
  'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',
  'ü': 'u', 'Ü': 'U', 'ı': 'i', 'İ': 'I',
  'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
};
function trNorm(s: string): string {
  return s.replace(/[şŞğĞüÜıİöÖçÇ]/g, (c) => TR_MAP[c] ?? c).toLowerCase();
}

// Stop kelimeler
const STOP_WORDS = new Set([
  'ile', 've', 'bir', 'bu', 'da', 'de', 'mi', 'mu', 'mü', 'ya', 'ya da',
  'the', 'and', 'with', 'from', 'for', 'of', 'in',
  'urun', 'urunleri', 'seri', 'kampanya', 'yeni', 'ozel', 'super',
]);

// Token seti: normalize + stop-word filtrele + min 2 harf
function tokenSet(s: string): Set<string> {
  const tokens = trNorm(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

// Jaccard benzerliği
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

// Miktar/gramaj çıkarma: "500 g" → 500, "1.5 L" → 1500 (ml cinsinden)
function extractQuantityMl(text: string): number | null {
  const lower = text.toLowerCase().replace(',', '.');

  // litre → ml
  const lMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|litre|liter)\b/);
  if (lMatch) return Math.round(parseFloat(lMatch[1]) * 1000);

  // ml
  const mlMatch = lower.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (mlMatch) return parseFloat(mlMatch[1]);

  // kg → gr
  const kgMatch = lower.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);

  // gr
  const gMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gram)\b/);
  if (gMatch) return parseFloat(gMatch[1]);

  return null;
}

// Gramaj benzerliği skoru
function quantitySimilarity(productText: string, offQuantity: string): number {
  const pQty = extractQuantityMl(productText);
  const oQty = extractQuantityMl(offQuantity);
  if (!pQty || !oQty) return 0.5;  // bilinmiyorsa nötr
  const ratio = Math.min(pQty, oQty) / Math.max(pQty, oQty);
  return ratio;                       // 1.0 = eşleşme, 0.5 = 2x fark
}

// ─────────────────────────────────────────────────────
// BÖLÜM 2: EAN doğrulama
// ─────────────────────────────────────────────────────

function detectFormat(code: string): BarcodeFormat | null {
  if (!/^\d+$/.test(code)) return null;
  if (code.length === 8)  return BarcodeFormat.EAN_8;
  if (code.length === 12) return BarcodeFormat.UPC_A;
  if (code.length === 13) return BarcodeFormat.EAN_13;
  return null;
}

function validateEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(code[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(code[12], 10);
}

function validateEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = parseInt(code[i], 10);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(code[7], 10);
}

function validateBarcode(code: string): { valid: boolean; format: BarcodeFormat | null; reason?: string } {
  const fmt = detectFormat(code);
  if (!fmt) return { valid: false, format: null, reason: `Geçersiz uzunluk: ${code.length}` };
  if (fmt === BarcodeFormat.EAN_13 && !validateEAN13(code)) {
    return { valid: false, format: fmt, reason: 'EAN-13 checksum hatası' };
  }
  if (fmt === BarcodeFormat.EAN_8 && !validateEAN8(code)) {
    return { valid: false, format: fmt, reason: 'EAN-8 checksum hatası' };
  }
  return { valid: true, format: fmt };
}

// ─────────────────────────────────────────────────────
// BÖLÜM 3: Confidence scoring (5 bileşen)
// ─────────────────────────────────────────────────────

interface ScoredCandidate {
  barcode: string;
  format:  BarcodeFormat;
  confidence: number;
  matchedName:  string;
  matchedBrand: string;
  source: string;
  scoreBreakdown: {
    name: number;
    brand: number;
    quantity: number;
    category: number;
    sourceTrust: number;
  };
}

const SOURCE_TRUST: Record<string, number> = {
  manual:       1.00,
  openfoodfacts: 0.80,
  html_scraper:  0.70,
};

function scoreCandidate(
  product: { name: string; brand: string | null; category?: { name: string } | null },
  candidate: {
    code: string;
    format: BarcodeFormat;
    offName: string;
    offBrand: string;
    offQuantity?: string;
    offCategory?: string;
    source: string;
  },
): ScoredCandidate | null {
  const pNameTokens = tokenSet(product.name);
  const cNameTokens = tokenSet(candidate.offName);

  const nameScore     = jaccard(pNameTokens, cNameTokens);
  const pBrandTokens  = product.brand ? tokenSet(product.brand) : new Set<string>();
  const cBrandTokens  = candidate.offBrand ? tokenSet(candidate.offBrand) : new Set<string>();
  const brandScore    = pBrandTokens.size > 0 && cBrandTokens.size > 0
    ? jaccard(pBrandTokens, cBrandTokens)
    : 0.5;   // marka yoksa nötr

  const quantityScore = candidate.offQuantity
    ? quantitySimilarity(product.name, candidate.offQuantity)
    : 0.5;   // nötr

  const pCatTokens  = product.category ? tokenSet(product.category.name) : new Set<string>();
  const cCatTokens  = candidate.offCategory ? tokenSet(candidate.offCategory) : new Set<string>();
  const categoryScore = pCatTokens.size > 0 && cCatTokens.size > 0
    ? jaccard(pCatTokens, cCatTokens)
    : 0.5;

  const sourceTrust = SOURCE_TRUST[candidate.source] ?? 0.70;

  // Ağırlıklı toplam
  const confidence = Math.min(1.0,
    nameScore     * 0.40 +
    brandScore    * 0.25 +
    quantityScore * 0.20 +
    categoryScore * 0.10 +
    sourceTrust   * 0.05,
  );

  return {
    barcode:      candidate.code,
    format:       candidate.format,
    confidence:   parseFloat(confidence.toFixed(3)),
    matchedName:  candidate.offName,
    matchedBrand: candidate.offBrand,
    source:       candidate.source,
    scoreBreakdown: {
      name:        parseFloat(nameScore.toFixed(3)),
      brand:       parseFloat(brandScore.toFixed(3)),
      quantity:    parseFloat(quantityScore.toFixed(3)),
      category:    parseFloat(categoryScore.toFixed(3)),
      sourceTrust: parseFloat(sourceTrust.toFixed(3)),
    },
  };
}

// ─────────────────────────────────────────────────────
// BÖLÜM 4: Open Food Facts arama
// ─────────────────────────────────────────────────────

interface OFFHit {
  code:           string;
  product_name?:  string;
  product_name_tr?: string;
  brands?:        string | string[];
  quantity?:      string;
  categories_tags?: string[];
}

async function searchOFF(productName: string, brand: string | null): Promise<OFFHit[]> {
  // Akıllı query: gramaj temizle, marka öne al
  const cleanName = trNorm(productName)
    .replace(/\d+\s*(g|gr|kg|ml|l|lt|litre|liter|adet|cl|x)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const words = cleanName.split(/\s+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const queryWords = brand
    ? [trNorm(brand), ...words].slice(0, 5)
    : words.slice(0, 5);
  const query = queryWords.join(' ');

  if (!query.trim()) return [];

  try {
    const { data } = await axios.get('https://search.openfoodfacts.org/search', {
      params: {
        q:         query,
        fields:    'code,product_name,product_name_tr,brands,quantity,categories_tags',
        page_size: 8,
        sort_by:   'unique_scans_n',
      },
      headers: {
        'User-Agent': 'AkilliSepet/2.0 (https://akillisepet.vercel.app)',
        'Accept':     'application/json',
      },
      timeout: 12000,
    });
    return (data?.hits ?? []) as OFFHit[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────
// BÖLÜM 5: Manuel barkod yükleyici
// ─────────────────────────────────────────────────────

interface ManualEntry {
  match:   string;
  brand:   string;
  barcode: string;
  format?: string;
  note?:   string;
}

function loadManualBarcodes(): ManualEntry[] {
  try {
    const raw = fs.readFileSync(MANUAL_FILE, 'utf-8');
    return JSON.parse(raw) as ManualEntry[];
  } catch {
    console.warn('  ⚠ manual-barcodes.json okunamadı, manuel kaynak atlanıyor');
    return [];
  }
}

// Bir ürünü manuel listesinden eşleştir
function matchManual(
  product: { name: string; brand: string | null; category?: { name: string } | null },
  manualList: ManualEntry[],
): ScoredCandidate | null {
  const pNorm = trNorm(product.name);

  for (const entry of manualList) {
    const matchNorm = trNorm(entry.match);
    // Product adı manuel eşleşme anahtar kelimesini içeriyor mu?
    if (!pNorm.includes(matchNorm) && !matchNorm.includes(pNorm.substring(0, 8))) {
      // Jaccard benzerliği dene
      const sim = jaccard(tokenSet(product.name), tokenSet(entry.match));
      if (sim < 0.5) continue;
    }

    const validation = validateBarcode(entry.barcode);
    if (!validation.valid || !validation.format) continue;

    const candidate = scoreCandidate(product, {
      code:      entry.barcode,
      format:    validation.format,
      offName:   entry.match,
      offBrand:  entry.brand,
      source:    'manual',
    });

    if (candidate && candidate.confidence >= 0.5) {  // Manuel için düşük eşik (güvenilir kaynak)
      candidate.confidence = Math.max(candidate.confidence, 0.80);  // Manuel min 0.80
      return candidate;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────
// BÖLÜM 6: Sonuç tipleri
// ─────────────────────────────────────────────────────

interface MatchResult {
  productId:   string;
  productName: string;
  brand:       string;
  candidate:   ScoredCandidate;
}

interface SkipResult {
  productName: string;
  reason:      string;
  topCandidate?: string;
  topScore?:   number;
}

// ─────────────────────────────────────────────────────
// BÖLÜM 7: Rapor üretimi
// ─────────────────────────────────────────────────────

function printReport(stats: {
  scanned:     number;
  accepted:    number;
  lowConf:     number;
  duplicate:   number;
  noResult:    number;
  manual:      number;
  off:         number;
  matches:     MatchResult[];
  skipped:     SkipResult[];
}) {
  console.log('\n' + '─'.repeat(60));
  console.log('📊 BARCODE ENRICHMENT RAPORU');
  console.log('─'.repeat(60));
  console.log(`  Taranan ürün sayısı   : ${stats.scanned}`);
  console.log(`  Kabul edilen          : ${stats.accepted}`);
  console.log(`    ↳ Manuel kaynak     : ${stats.manual}`);
  console.log(`    ↳ Open Food Facts   : ${stats.off}`);
  console.log(`  Düşük skor ile reddedilen : ${stats.lowConf}`);
  console.log(`  Duplicate (atlandı)   : ${stats.duplicate}`);
  console.log(`  Sonuç bulunamadı      : ${stats.noResult}`);

  if (stats.matches.length > 0) {
    console.log('\n✅ En İyi Eşleşmeler (ilk 15):');
    console.log('  ' + '─'.repeat(90));
    console.log(
      '  ' + 'Ürün'.padEnd(32) + 'Eşleşen'.padEnd(28) + 'Barkod'.padEnd(16) + 'Kaynak'.padEnd(8) + 'Güven',
    );
    console.log('  ' + '─'.repeat(90));
    stats.matches.slice(0, 15).forEach((m) => {
      console.log(
        '  '
        + m.productName.substring(0, 31).padEnd(32)
        + m.candidate.matchedName.substring(0, 27).padEnd(28)
        + m.candidate.barcode.padEnd(16)
        + m.candidate.source.padEnd(8)
        + m.candidate.confidence.toFixed(2),
      );
    });
  }

  if (stats.skipped.length > 0) {
    const lowConf = stats.skipped.filter((s) => s.topScore !== undefined).slice(0, 10);
    if (lowConf.length > 0) {
      console.log('\n❌ Reddedilen (düşük skor, ilk 10):');
      console.log('  ' + '─'.repeat(70));
      lowConf.forEach((s) => {
        console.log(`  ${s.productName.substring(0, 40).padEnd(40)} → ${s.reason} (skor: ${s.topScore?.toFixed(2)})`);
      });
    }
  }
  console.log('─'.repeat(60));
}

async function writeJsonReport(
  args: ReturnType<typeof parseArgs>,
  stats: Parameters<typeof printReport>[0],
  demoProducts: object[],
) {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

  // Ana rapor
  const reportPath = path.join(REPORTS_DIR, `barcode-enrichment-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    dryRun:      args.dryRun,
    params: {
      limit:         args.limit,
      minConfidence: args.minConfidence,
      source:        args.source,
    },
    summary: {
      scanned:   stats.scanned,
      accepted:  stats.accepted,
      lowConf:   stats.lowConf,
      duplicate: stats.duplicate,
      noResult:  stats.noResult,
      manual:    stats.manual,
      off:       stats.off,
    },
    accepted: stats.matches.map((m) => ({
      productId:   m.productId,
      productName: m.productName,
      brand:       m.brand,
      barcode:     m.candidate.barcode,
      format:      m.candidate.format,
      source:      m.candidate.source,
      confidence:  m.candidate.confidence,
      matchedName: m.candidate.matchedName,
      scoreBreakdown: m.candidate.scoreBreakdown,
    })),
  }, null, 2));
  console.log(`\n📄 Rapor: ${reportPath}`);

  // Demo ürünler raporu
  const demoPath = path.join(REPORTS_DIR, 'barcode-demo-products.json');
  fs.writeFileSync(demoPath, JSON.stringify(demoProducts, null, 2));
  console.log(`🎯 Demo ürünler: ${demoPath}`);
}

// ─────────────────────────────────────────────────────
// BÖLÜM 8: Demo ürün raporu üretici
// ─────────────────────────────────────────────────────

async function generateDemoProducts(): Promise<object[]> {
  const barcoded = await prisma.barcode.findMany({
    include: {
      product: {
        include: {
          category:  { select: { name: true } },
          prices:    { where: { isAvailable: true }, include: { market: { select: { name: true } } } },
        },
      },
    },
  });

  const demoList = barcoded
    .filter((b) => b.product.imageUrl && b.product.prices.length >= 2)
    .map((b) => ({
      productName:       b.product.name,
      barcode:           b.code,
      format:            b.format,
      brand:             b.product.brand ?? '—',
      category:          b.product.category?.name ?? '—',
      imageUrl:          b.product.imageUrl,
      priceCount:        b.product.prices.length,
      marketsWithPrices: [...new Set(b.product.prices.map((p) => p.market.name))],
    }))
    .sort((a, b) => b.priceCount - a.priceCount)
    .slice(0, 10);

  console.log(`\n🎯 Demo için ${demoList.length} ürün hazırlandı (2+ market, görselli):`);
  demoList.forEach((d, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${d.productName.substring(0, 45).padEnd(45)} ${d.barcode}  (${d.priceCount} market)`);
  });

  return demoList;
}

// ─────────────────────────────────────────────────────
// BÖLÜM 9: Ana döngü
// ─────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║    Barcode Enrichment Pipeline v2 — Akıllı Sepet ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log(`  mod:            ${args.dryRun ? '🔍 DRY-RUN (DB\'ye yazılmaz)' : '✏️  CANLI (DB\'ye yazar)'}`);
  console.log(`  limit:          ${args.limit}`);
  console.log(`  minConfidence:  ${args.minConfidence}`);
  console.log(`  kaynak:         ${args.source}`);
  console.log(`  OFF delay:      ${args.delayMs}ms`);
  console.log(`  sadece fiyatlı: ${args.onlyPricedProducts}`);
  console.log(`  rapor üret:     ${args.writeReport}`);
  console.log();

  // Manuel barkodları yükle
  const manualBarcodes = args.useManual ? loadManualBarcodes() : [];
  if (manualBarcodes.length > 0) {
    console.log(`📋 ${manualBarcodes.length} manuel barkod yüklendi\n`);
  }

  // Barkodsuz ürünleri getir (fazla çek, sonra filtrele)
  const priceFilter = args.onlyPricedProducts
    ? { prices: { some: { isAvailable: true } } }
    : {};

  const allProducts = await prisma.product.findMany({
    where: { isActive: true, barcodes: { none: {} }, ...priceFilter },
    select: {
      id:       true,
      name:     true,
      brand:    true,
      category: { select: { name: true } },
    },
    take:    args.limit * 3,
    orderBy: { prices: { _count: 'desc' } },
  });

  const products = allProducts.slice(0, args.limit);
  console.log(`📦 ${allProducts.length} barkodsuz ürün bulundu → ${products.length} taranacak\n`);

  // İstatistik sayaçlar
  const matches:  MatchResult[] = [];
  const skipped:  SkipResult[]  = [];
  let duplicateCount = 0;
  let noResultCount  = 0;
  let manualCount    = 0;
  let offCount       = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const prefix  = `[${(i + 1).toString().padStart(3)}/${products.length}]`;

    process.stdout.write(`  ${prefix} ${product.name.substring(0, 45).padEnd(45)} → `);

    let best: ScoredCandidate | null = null;

    // ── Kaynak 1: Manuel barkodlar ─────────────────────
    if (args.useManual && manualBarcodes.length > 0) {
      const manualMatch = matchManual(product, manualBarcodes);
      if (manualMatch) {
        best = manualMatch;
        process.stdout.write(`📋 manuel (${best.confidence.toFixed(2)}) `);
      }
    }

    // ── Kaynak 2: Open Food Facts ───────────────────────
    if (!best && args.useOFF) {
      const hits = await searchOFF(product.name, product.brand);

      if (hits.length === 0) {
        // OFF yanıt vermedi
      } else {
        for (const hit of hits) {
          if (!hit.code || hit.code.length < 8) continue;
          const validation = validateBarcode(hit.code);
          if (!validation.valid || !validation.format) continue;

          const offName  = hit.product_name_tr || hit.product_name || '';
          const offBrand = Array.isArray(hit.brands)
            ? (hit.brands[0] ?? '')
            : (hit.brands?.split(',')[0]?.trim() ?? '');
          const offQty = hit.quantity ?? '';
          const offCat = hit.categories_tags?.[0]?.replace('en:', '') ?? '';

          const scored = scoreCandidate(product, {
            code:        hit.code,
            format:      validation.format,
            offName,
            offBrand,
            offQuantity: offQty,
            offCategory: offCat,
            source:      'openfoodfacts',
          });
          if (scored && (!best || scored.confidence > best.confidence)) {
            best = scored;
          }
        }
        if (best) {
          process.stdout.write(`🌐 OFF (${best.confidence.toFixed(2)}) `);
        }
      }
      await sleep(args.delayMs);
    }

    // ── Sonuç değerlendirme ─────────────────────────────
    if (!best) {
      console.log('✗ sonuç yok');
      noResultCount++;
      skipped.push({ productName: product.name, reason: 'Hiçbir kaynakta bulunamadı' });
      continue;
    }

    if (best.confidence < args.minConfidence) {
      console.log(`✗ düşük skor (${best.confidence.toFixed(2)} < ${args.minConfidence})`);
      skipped.push({
        productName:  product.name,
        reason:       `Skor eşiği altında`,
        topCandidate: best.matchedName,
        topScore:     best.confidence,
      });
      continue;
    }

    // Duplicate kontrol
    const existing = await prisma.barcode.findUnique({ where: { code: best.barcode } });
    if (existing) {
      console.log(`↩ duplicate (${best.barcode})`);
      duplicateCount++;
      skipped.push({ productName: product.name, reason: `Barkod başka ürüne bağlı: ${best.barcode}` });
      continue;
    }

    // Kabul
    console.log(`✅ ${best.source} → ${best.barcode} (güven: ${best.confidence.toFixed(2)})`);
    matches.push({ productId: product.id, productName: product.name, brand: product.brand ?? '', candidate: best });

    if (best.source === 'manual') manualCount++;
    else offCount++;

    // DB'ye yaz
    if (!args.dryRun) {
      await prisma.barcode.create({
        data: { code: best.barcode, format: best.format, productId: product.id },
      });
    }
  }

  // ── Rapor ────────────────────────────────────────────
  const statsObj = {
    scanned:   products.length,
    accepted:  matches.length,
    lowConf:   skipped.filter((s) => s.topScore !== undefined).length,
    duplicate: duplicateCount,
    noResult:  noResultCount,
    manual:    manualCount,
    off:       offCount,
    matches,
    skipped,
  };

  printReport(statsObj);

  if (args.dryRun) {
    console.log('\n🔍 DRY-RUN modunda çalıştı — DB\'ye hiçbir şey yazılmadı.');
    console.log('   Gerçek import için: --dry-run parametresi olmadan çalıştır.\n');
  } else {
    console.log(`\n✅ ${matches.length} barkod DB\'ye kaydedildi.\n`);
  }

  // Demo ürün listesi
  const demoProducts = await generateDemoProducts();

  // JSON raporu
  if (args.writeReport) {
    await writeJsonReport(args, statsObj, demoProducts);
  }
}

main()
  .catch((e) => { console.error('\n❌ Pipeline hatası:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
