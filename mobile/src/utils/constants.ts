// =====================================================
// Akıllı Sepet - Sabit Degerler ve Yardimci Fonksiyonlar
// =====================================================

import { resolveApiBaseUrl, getApiUrlDebugInfo } from './apiUrl';

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  const info = getApiUrlDebugInfo();
  console.log(`[Akıllı Sepet] API: ${info.url} (${info.source})`);
}

// Fiyat donusumu: kurus -> TL
export const PRICE_DIVISOR = 100;

export function formatPrice(amountInKurus: number): string {
  return `₺${(amountInKurus / PRICE_DIVISOR).toFixed(2)}`;
}

// Turkce durum etiketleri
export const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Beklemede',
  UNDER_REVIEW: 'İnceleniyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  RESOLVED: 'Çözüldü',
};

// Durum renkleri
export const REPORT_STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  UNDER_REVIEW: '#3B82F6',
  APPROVED: '#10B981',
  REJECTED: '#EF4444',
  RESOLVED: '#6B7280',
};

// Market marka renkleri (fallback)
export const DEFAULT_MARKET_COLORS = [
  '#F97316', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#EF4444', '#F59E0B', '#06B6D4',
];

// Kategori ikonlari (Ionicons) — DB kategori isimleriyle eslestirilmis
export const CATEGORY_ICONS: Record<string, string> = {
  'Meyve & Sebze':  'nutrition-outline',
  'Süt Ürünleri':   'water-outline',
  'Et & Tavuk':     'restaurant-outline',
  'İçecekler':      'cafe-outline',
  'Gıda':           'basket-outline',
  'Temizlik':       'sparkles-outline',
  'Kişisel Bakım':  'body-outline',
  'Dondurulmuş':    'snow-outline',
  'Atıştırmalık':   'pizza-outline',
  'Konserve':       'file-tray-stacked-outline',
  default:          'grid-outline',
};

// Reaktif debounce suresi (ms)
export const SEARCH_DEBOUNCE_MS = 400;

// Uygulama renk paleti
export const COLORS = {
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  background: '#F9FAFB',
  white: '#FFFFFF',
  card: '#FFFFFF',
};

/** GG.AA.YYYY veya ISO tarihi API formatina (YYYY-MM-DD) cevirir */
export function toApiDateString(value: string): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
  if (tr) return `${tr[3]}-${tr[2]}-${tr[1]}`;
  return trimmed;
}

/** Axios hata yanitindan kullaniciya gosterilecek mesaj */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string | string[]; errors?: string[] } } })
    ?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.join('\n');
  }
  if (Array.isArray(data?.message)) return data.message.join('\n');
  if (typeof data?.message === 'string' && data.message !== 'Dogrulama hatasi') {
    return data.message;
  }
  return fallback;
}
