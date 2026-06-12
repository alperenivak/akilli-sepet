-- Market scraper alanlari: sitemap URL + etkin bayrak

ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "sitemapUrl" TEXT;
ALTER TABLE "markets" ADD COLUMN IF NOT EXISTS "scraperEnabled" BOOLEAN NOT NULL DEFAULT false;
