// =====================================================
// Crowdsource Fiyat Pipeline Sabitleri
// Otomatik onay, geçici yansıtma ve admin kuyruğu
// =====================================================

/** Güvenilir kullanıcı — tek bildirimle hızlı onay */
export const TRUSTED_USER_MIN_SCORE = 3.0;

/** Topluluk konsensusu — ağırlıklı eşik (5 ham yerine ~3.5 ağırlıklı) */
export const WEIGHTED_CONSENSUS_THRESHOLD = 3.5;
export const WEIGHTED_CV_MAX = 0.12;
export const CONSENSUS_WINDOW_DAYS = 30;

/** Migros referansına göre anormallik */
export const ABNORMAL_UPPER_RATIO = 2.0;
export const ABNORMAL_LOWER_RATIO = 1 / 3;

/** Hızlı onay toleransları */
export const TRUSTED_MIGROS_TOLERANCE = 0.3;
export const TRUSTED_EXISTING_TOLERANCE = 0.12;
export const PLAUSIBLE_MIGROS_TOLERANCE = 0.35;

/** Geçici (provisional) fiyat güven tavanı */
export const PROVISIONAL_MAX_CONFIDENCE = 0.38;
export const MIN_CONFIDENCE_FOR_CART = 0.3;

/** Aynı kullanıcı tekrar bildirim bekleme süresi */
export const DUPLICATE_COOLDOWN_HOURS = 24;

export type CrowdsourceOutcome =
  | 'AUTO_APPROVED_TRUSTED'
  | 'AUTO_APPROVED_CONSENSUS'
  | 'PROVISIONAL'
  | 'ADMIN_REVIEW'
  | 'QUEUED';

export const OUTCOME_MESSAGES: Record<CrowdsourceOutcome, string> = {
  AUTO_APPROVED_TRUSTED:
    'Güvenilir kaynak olarak bildiriminiz doğrudan onaylandı ve fiyata yansıdı.',
  AUTO_APPROVED_CONSENSUS:
    'Topluluk konsensusu oluştu — fiyat otomatik onaylandı ve güncellendi.',
  PROVISIONAL:
    'Fiyat geçici olarak yansıtıldı. Daha fazla doğrulama ile güvenilirlik artacak.',
  ADMIN_REVIEW:
    'Bildiriminiz anormal fiyat aralığında — uzman incelemesine alındı.',
  QUEUED:
    'Bildiriminiz alındı. Benzer bildirimler biriktikçe otomatik onaylanacak.',
};
