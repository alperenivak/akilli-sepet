-- Market scraper yapilandirma alanlari
CREATE TYPE "ScraperType" AS ENUM ('SITEMAP_HTML', 'MIGROS_API');

ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "scraperType" "ScraperType" DEFAULT 'SITEMAP_HTML';
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "scraperNameSelector" TEXT;
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "scraperPriceSelector" TEXT;
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "scraperUrlPattern" TEXT;

-- Migros: acik REST API ile canli veri
UPDATE "markets" SET
  "scraperEnabled" = true,
  "scraperType" = 'MIGROS_API'
WHERE "slug" = 'migros';
