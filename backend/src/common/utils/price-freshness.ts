// =====================================================
// Fiyat tazelik hesaplama — paylasilan mantik
// =====================================================

export type PriceFreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unknown';

export function computePriceFreshness(
  lastUpdated: Date | string | null | undefined,
  freshDays = 3,
  agingDays = 7,
): PriceFreshnessLevel {
  if (!lastUpdated) return 'unknown';
  const updated = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
  if (Number.isNaN(updated.getTime())) return 'unknown';

  const days = Math.floor((Date.now() - updated.getTime()) / 86400000);
  if (days <= freshDays) return 'fresh';
  if (days <= agingDays) return 'aging';
  return 'stale';
}

export function enrichPriceWithFreshness<T extends { lastUpdated: Date; needsVerification?: boolean }>(
  price: T,
  freshDays = 3,
  agingDays = 7,
): T & { freshness: PriceFreshnessLevel } {
  const freshness = price.needsVerification
    ? 'stale'
    : computePriceFreshness(price.lastUpdated, freshDays, agingDays);
  return { ...price, freshness };
}
