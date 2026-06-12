// =====================================================
// Fiyat tazelik gosterimi — mobil
// =====================================================

export type PriceFreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unknown';

const FRESH_DAYS = 3;
const AGING_DAYS = 7;

export function computePriceFreshness(
  lastUpdated?: string | null,
  needsVerification?: boolean,
): PriceFreshnessLevel {
  if (needsVerification) return 'stale';
  if (!lastUpdated) return 'unknown';
  const days = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400000);
  if (days <= FRESH_DAYS) return 'fresh';
  if (days <= AGING_DAYS) return 'aging';
  return 'stale';
}

export function freshnessLabel(level: PriceFreshnessLevel): string {
  switch (level) {
    case 'fresh': return 'Güncel fiyat';
    case 'aging': return 'Yakın zamanda güncellendi';
    case 'stale': return 'Fiyat doğrulanmadı';
    default: return '';
  }
}

export function freshnessColor(level: PriceFreshnessLevel): string {
  switch (level) {
    case 'fresh': return '#059669';
    case 'aging': return '#d97706';
    case 'stale': return '#dc2626';
    default: return '#94a3b8';
  }
}
