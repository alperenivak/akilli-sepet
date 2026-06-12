// Market slug → Migros referansina gore fiyat carpani araligi
export const MARKET_PRICE_FACTORS: Record<string, { min: number; max: number }> = {
  bim:         { min: 0.80, max: 0.85 },
  a101:        { min: 0.82, max: 0.87 },
  sok:         { min: 0.81, max: 0.86 },
  carrefoursa: { min: 1.00, max: 1.05 },
  macrocenter: { min: 1.02, max: 1.08 },
};

/** Seed verisi baslangic guven skoru */
export const SEED_CONFIDENCE_SCORE = 0.2;

/** Rastgele fiyat sapmasi (+/- %3) */
export const PRICE_RANDOM_NOISE = 0.03;
