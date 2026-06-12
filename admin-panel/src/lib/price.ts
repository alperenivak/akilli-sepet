/** Fiyatlar API ve veritabanında kuruş (Int) olarak saklanır: 29,99 TL → 2999 */

export const PRICE_DIVISOR = 100;

/** Kuruş → TL sayısı */
export function kurusToTl(kurus: number): number {
  return kurus / PRICE_DIVISOR;
}

/** TL → kuruş (kaydetme için) */
export function tlToKurus(tl: number): number {
  return Math.round(tl * PRICE_DIVISOR);
}

/** Kuruş → "₺29,99" formatı */
export function formatPriceFromKurus(kurus: number): string {
  return `₺${kurusToTl(kurus).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Form input için TL string (2 ondalık) */
export function kurusToTlInput(kurus: number): string {
  return kurusToTl(kurus).toFixed(2);
}

/** Form input string → kuruş */
export function parseTlInput(value: string): number {
  const n = parseFloat(value.replace(',', '.'));
  if (Number.isNaN(n) || n < 0) return 0;
  return tlToKurus(n);
}
