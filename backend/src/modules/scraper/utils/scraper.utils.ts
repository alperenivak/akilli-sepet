// =====================================================
// Scraper yardimci fonksiyonlari
// =====================================================

/** IP ban riskini azaltmak icin rastgele bekleme (ms) */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fiyat metnini kuruşa çevirir.
 * Ornekler: "29,99 TL" -> 2999 | "29.99" -> 2999 | "1.299,50" -> 129950
 */
export function parsePriceToKurus(raw: string): number | null {
  if (!raw?.trim()) return null;

  let text = raw.replace(/\s/g, '').replace(/TL|₺|tl/gi, '').trim();
  if (!text) return null;

  // Binlik ayraci nokta, ondalik virgul: 1.299,50
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(text)) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',') && !text.includes('.')) {
    text = text.replace(',', '.');
  }

  const value = parseFloat(text);
  if (Number.isNaN(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/**
 * Urun adini karsilastirma icin normalize eder.
 * "Pinar Sut 1 L", "Pınar Süt 1lt", "PINAR SUT 1Litre" → "pinar sut 1l"
 * Boylece ayni urun farkli marketlerde birlestirilebilir.
 */
/**
 * Urun adini karsilastirma icin normalize eder.
 * "Pinar Sut 1 L", "Pınar Süt 1lt", "PINAR SUT 1Litre" → "pinar sut 1l"
 * Boylece ayni urun farkli marketlerde birlestirilebilir.
 */
export function normalizeProductName(raw: string): string {
  let n = raw.trim().toLowerCase();

  // Turkce karakterler
  n = n.replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g')
       .replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
       .replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u');

  // Ondalik virgulu nokta yap: 1,5 → 1.5
  n = n.replace(/(\d),(\d)/g, '$1.$2');

  // Birim standardizasyonu (sayi + bosluk + birim → sayiBirim)
  // Her birimin kisaltmasi da dahil
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:litre|liter|litres|liters|lt|l)\b/g, '$1l');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:kilogram|kilograms|kilo|kg)\b/g, '$1kg');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:mililitre|millilitre|milil|ml)\b/g, '$1ml');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:gram|grams|gr|g)\b/g, '$1g');
  n = n.replace(/(\d+(?:\.\d+)?)\s*(?:adet|adt)\b/g, '$1ad');
  n = n.replace(/(\d+(?:\.\d+)?)\s*cl\b/g, '$1cl');

  // Ondalik nokta: "1.5kg" → "15kg" (slug tutarlilik: 1,5 ve 1.5 ayni sonucu uretir)
  n = n.replace(/(\d)\.(\d)/g, '$1$2');

  // Noktalama kaldır (birim normalizasyonundan sonra)
  n = n.replace(/[^a-z0-9\s]/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();

  return n;
}

/** Karsilastirma icin kanonical slug uretir — ayni urun farkli formatlarda ayni slug'i verir */
export function slugifyName(name: string): string {
  return normalizeProductName(name)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Urun adindan birim ve miktar cikarir (or. "Pinar Sut 1 L" → litre, 1) */
export function parseUnitFromProductName(name: string): { unit: string; unitValue: number } | null {
  const multi = name.match(/(\d+)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(ml|g|gr|gram|lt|l|litre)/i);
  if (multi) {
    const count = parseInt(multi[1], 10);
    const val = parseFloat(multi[2].replace(',', '.'));
    const u = multi[3].toLowerCase();
    if (u.startsWith('l')) return { unit: 'ml', unitValue: count * val * 1000 };
    if (u.startsWith('g')) return { unit: 'g', unitValue: count * val };
    return { unit: 'ml', unitValue: count * val };
  }

  const patterns: [RegExp, string][] = [
    [/(\d+(?:[.,]\d+)?)\s*(?:litre|liter|lt|l)\b/i, 'litre'],
    [/(\d+(?:[.,]\d+)?)\s*(?:kilogram|kilo|kg)\b/i, 'kg'],
    [/(\d+(?:[.,]\d+)?)\s*(?:mililitre|millilitre|ml)\b/i, 'ml'],
    [/(\d+(?:[.,]\d+)?)\s*(?:gram|grams|gr|g)\b/i, 'g'],
    [/(\d+(?:[.,]\d+)?)\s*(?:adet|adt|li)\b/i, 'adet'],
    [/(\d+(?:[.,]\d+)?)\s*cl\b/i, 'ml'],
  ];

  for (const [re, unit] of patterns) {
    const m = name.match(re);
    if (!m) continue;
    let val = parseFloat(m[1].replace(',', '.'));
    if (unit === 'ml' && re.source.includes('cl')) val *= 10;
    return { unit, unitValue: val };
  }
  return null;
}
