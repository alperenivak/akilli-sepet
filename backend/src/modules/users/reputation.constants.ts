// =====================================================
// Itibar Sistemi Sabitleri
// Fiyat dogrulama (ok/carpı) + fiyat bildirimi birlesik
// =====================================================

export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 5;
export const REPUTATION_DEFAULT = 0;

/** Olay basina itibar puanlari */
export const REPUTATION_POINTS = {
  VERIFY_CORRECT: 0.05,
  VERIFY_INCORRECT: 0.03,
  SUBMIT_PRICE: 0.08,
  SUBMIT_APPROVED: 0.25,
  SUBMIT_REJECTED: -0.2,
  SUBMIT_AUTO_APPROVED: 0.2,
  /** Barkod katkisi — fiyat dogrulamadan (0.05) daha yuksek */
  SUBMIT_BARCODE: 0.1,
  SUBMIT_BARCODE_APPROVED: 0.35,
  SUBMIT_BARCODE_REJECTED: -0.15,
  /** Urunu markete ilk ekleme — en yuksek katki odulu */
  SUBMIT_MARKET_LISTING: 0.12,
  SUBMIT_MARKET_LISTING_APPROVED: 0.4,
  SUBMIT_MARKET_LISTING_REJECTED: -0.2,
} as const;

/** Itibar seviyeleri — mobil ve admin UI */
export const REPUTATION_LEVELS = [
  { min: 0, label: 'Yeni Üye', icon: '🌱', color: '#9CA3AF', perk: 'Fiyat doğrula — partner kuponlarına yaklaş' },
  { min: 1.2, label: 'Gözlemci', icon: '👀', color: '#60A5FA', perk: 'BİM %3 kuponunu aç' },
  { min: 2.0, label: 'Fiyat Avcısı', icon: '🎯', color: '#34D399', perk: 'A101 %5 partner kuponu' },
  { min: 3.0, label: 'Güvenilir Kaynak', icon: '⭐', color: '#FBBF24', perk: 'ŞOK %8 kupon + bildirim ağırlığı x1.5' },
  { min: 4.2, label: 'Topluluk Elçisi', icon: '🏆', color: '#A78BFA', perk: 'CarrefourSA %10 premium kupon' },
] as const;

/** Crowdsource hesabinda kullanici agirligi (1.0 - 2.0) */
export function reputationTrustWeight(score: number): number {
  if (score >= 4.2) return 2.0;
  if (score >= 3.0) return 1.5;
  if (score >= 2.0) return 1.25;
  if (score >= 1.2) return 1.1;
  return 1.0;
}

export function getReputationLevel(score: number) {
  const levels = [...REPUTATION_LEVELS].reverse();
  return levels.find((l) => score >= l.min) ?? REPUTATION_LEVELS[0];
}

export function getNextReputationLevel(score: number) {
  return REPUTATION_LEVELS.find((l) => l.min > score) ?? null;
}

export function levelProgressPercent(score: number): number {
  const current = getReputationLevel(score);
  const next = getNextReputationLevel(score);
  if (!next) return 100;
  const range = next.min - current.min;
  if (range <= 0) return 0;
  const progress = score - current.min;
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}

/** Katkı yokken eski varsayılan (1.0) skoru gösterme — yeni kullanıcı 0 ile başlar */
export function hasReputationContribution(input: {
  eventCount: number;
  verifications: number;
  submissions: number;
  approved: number;
  rejected: number;
}): boolean {
  return (
    input.eventCount > 0
    || input.verifications + input.submissions + input.approved + input.rejected > 0
  );
}

export function resolveEffectiveReputationScore(
  storedScore: number,
  input: Parameters<typeof hasReputationContribution>[0],
): number {
  return hasReputationContribution(input) ? storedScore : REPUTATION_DEFAULT;
}
