// =====================================================
// Satın alma niyeti skoru — baktığın ürünleri önceliklendir
// =====================================================

import { Product } from '../types/api';
import { ViewRecord } from '../store/viewHistoryStore';

export type IntentKind =
  | 'JUST_VIEWED'
  | 'RETURNING'
  | 'PRICE_DROP'
  | 'READY_TO_BUY'
  | 'STILL_THINKING'
  | 'IN_CART';

export interface IntentBadge {
  kind: IntentKind;
  label: string;
  color: string;
  pitch: string;
}

export interface ScoredView {
  record: ViewRecord;
  score: number;
  badge: IntentBadge;
  priceDropPercent: number;
  inCart: boolean;
}

const BADGE_META: Record<IntentKind, { label: string; color: string }> = {
  JUST_VIEWED:    { label: 'Az önce baktın', color: '#2563eb' },
  RETURNING:      { label: 'Tekrar ilgini çekti', color: '#7c3aed' },
  PRICE_DROP:     { label: 'Fiyat düştü!', color: '#059669' },
  READY_TO_BUY:   { label: 'Sepete ekle', color: '#ea580c' },
  STILL_THINKING: { label: 'Hâlâ düşünüyor musun?', color: '#d97706' },
  IN_CART:        { label: 'Sepetinde', color: '#64748b' },
};

function hoursSince(iso: string, now = Date.now()) {
  return (now - new Date(iso).getTime()) / 3_600_000;
}

function calcPriceDrop(prev?: number, current?: number): number {
  if (!prev || !current || prev <= 0 || current >= prev) return 0;
  return Math.round(((prev - current) / prev) * 100);
}

export function resolveIntentBadge(
  record: ViewRecord,
  opts: { inCart: boolean; currentPrice?: number; priceDropPercent: number },
): IntentBadge {
  const hours = hoursSince(record.viewedAt);
  let kind: IntentKind = 'STILL_THINKING';

  if (opts.inCart) {
    kind = 'IN_CART';
  } else if (opts.priceDropPercent >= 3) {
    kind = 'PRICE_DROP';
  } else if (hours < 6) {
    kind = 'JUST_VIEWED';
  } else if (record.viewCount >= 2 && hours < 168) {
    kind = record.viewCount >= 3 && hours < 72 ? 'READY_TO_BUY' : 'RETURNING';
  } else if (hours < 48 && record.viewCount === 1) {
    kind = 'STILL_THINKING';
  }

  const meta = BADGE_META[kind];
  const pitch = buildPitch(kind, record, opts.priceDropPercent, hours);

  return { kind, label: meta.label, color: meta.color, pitch };
}

function buildPitch(
  kind: IntentKind,
  record: ViewRecord,
  dropPct: number,
  hours: number,
): string {
  switch (kind) {
    case 'PRICE_DROP':
      return `%${dropPct} indirim — ${record.name} için şimdi almak avantajlı.`;
    case 'READY_TO_BUY':
      return `${record.viewCount} kez baktın; en uygun fiyatı kaçırma.`;
    case 'RETURNING':
      return 'Bu ürün seni tekrar çekti — fiyatları karşılaştır.';
    case 'JUST_VIEWED':
      return hours < 1 ? 'Az önce inceledin, karar verme zamanı.' : 'Bugün baktığın ürün burada.';
    case 'IN_CART':
      return 'Zaten sepetinde — siparişi tamamlamayı unutma.';
    default:
      return 'En ucuz marketi bul, tasarruf et.';
  }
}

export function scoreViewRecord(
  record: ViewRecord,
  cartProductIds: Set<string>,
  currentPrice?: number,
  now = Date.now(),
): ScoredView {
  const hours = hoursSince(record.viewedAt, now);
  const inCart = cartProductIds.has(record.productId);
  const priceDropPercent = calcPriceDrop(record.lowestPriceAtView, currentPrice);

  let score = 0;
  score += Math.exp(-hours / 36) * 45;
  score += Math.min(record.viewCount, 6) * 14;
  if (hours < 24) score += 22;
  if (record.viewCount >= 2 && !inCart) score += 32;
  if (priceDropPercent >= 3) score += 20 + priceDropPercent;
  if (inCart) score -= 25;

  const badge = resolveIntentBadge(record, { inCart, currentPrice, priceDropPercent });

  return { record, score, badge, priceDropPercent, inCart };
}

export function rankViewRecords(
  records: ViewRecord[],
  cartProductIds: Set<string>,
  priceMap?: Map<string, number>,
): ScoredView[] {
  return records
    .map((r) => scoreViewRecord(r, cartProductIds, priceMap?.get(r.productId)))
    .sort((a, b) => b.score - a.score);
}

export function getDominantCategoryId(records: ViewRecord[]): string | undefined {
  const weights = new Map<string, number>();
  for (const r of records) {
    if (!r.categoryId) continue;
    const w = (weights.get(r.categoryId) ?? 0) + r.viewCount * Math.exp(-hoursSince(r.viewedAt) / 72);
    weights.set(r.categoryId, w);
  }
  let best: string | undefined;
  let bestW = 0;
  weights.forEach((w, id) => {
    if (w > bestW) { bestW = w; best = id; }
  });
  return best;
}

export function sectionPitch(scored: ScoredView[]): string {
  if (scored.length === 0) return 'Ürünlere göz at, sana özel öneriler burada belirecek.';
  const top = scored[0];
  if (top.badge.kind === 'PRICE_DROP') return 'Baktığın ürünlerden birinde fiyat düştü — kaçırma!';
  if (top.badge.kind === 'READY_TO_BUY') return 'Tekrar tekrar baktığın ürünler hazır — sepete eklemeye ne dersin?';
  if (top.badge.kind === 'JUST_VIEWED') return 'Az önce incelediğin ürünler seni bekliyor.';
  return 'İlgi gösterdiğin ürünler ve benzerleri senin için derlendi.';
}

export function snapshotFromProduct(product: Product): Pick<ViewRecord, 'name' | 'imageUrl' | 'categoryId' | 'brand' | 'lowestPriceAtView' | 'lowestPriceMarket'> {
  return {
    name: product.name,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    brand: product.brand,
    lowestPriceAtView: product.lowestPrice ?? undefined,
    lowestPriceMarket: product.lowestPriceMarket?.name,
  };
}
