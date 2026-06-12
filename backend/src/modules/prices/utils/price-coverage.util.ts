import { MARKET_PRICE_FACTORS, PRICE_RANDOM_NOISE } from '../constants/market-price-factors';

export function randomFactor(min: number, max: number): number {
  const base = min + Math.random() * (max - min);
  const noise = (Math.random() * 2 - 1) * PRICE_RANDOM_NOISE;
  return base + noise;
}

export function roundToNearest5(amount: number): number {
  return Math.round(amount / 5) * 5;
}

export function marketMidFactor(slug: string): number {
  if (slug === 'migros') return 1.0;
  const f = MARKET_PRICE_FACTORS[slug];
  if (!f) return 1.0;
  return (f.min + f.max) / 2;
}

/** Herhangi bir market fiyatini Migros esdegerine cevirir */
export function toMigrosEquivalent(amount: number, sourceSlug: string): number {
  return amount / marketMidFactor(sourceSlug);
}

/** Migros esdegerinden hedef market fiyatini uretir */
export function fromMigrosEquivalent(migrosEq: number, targetSlug: string): number {
  if (targetSlug === 'migros') return migrosEq;
  const factor = MARKET_PRICE_FACTORS[targetSlug];
  if (!factor) return migrosEq;
  return migrosEq * randomFactor(factor.min, factor.max);
}

export interface PriceReference {
  amount: number;
  discountedAmount: number | null;
  isSeedData: boolean;
  marketSlug: string;
}

/** Mevcut fiyatlardan referans Migros esdegeri hesapla */
export function computeReferenceMigrosEquivalent(refs: PriceReference[]): number | null {
  if (refs.length === 0) return null;
  const realRefs = refs.filter((p) => !p.isSeedData);
  const pool = realRefs.length > 0 ? realRefs : refs;
  const sum = pool.reduce((acc, p) => {
    const amt = p.discountedAmount ?? p.amount;
    return acc + toMigrosEquivalent(amt, p.marketSlug);
  }, 0);
  return sum / pool.length;
}

/** Hedef market icin seed fiyati uret */
export function estimateSeedAmount(migrosEq: number, targetSlug: string): number {
  return roundToNearest5(Math.round(fromMigrosEquivalent(migrosEq, targetSlug)));
}
