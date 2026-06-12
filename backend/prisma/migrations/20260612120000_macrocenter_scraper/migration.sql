-- Macrocenter marketi ekle veya scraper alanlarini guncelle
INSERT INTO "markets" (
  "id", "name", "slug", "brandColor", "website", "description",
  "scraperEnabled", "scraperType", "sitemapUrl",
  "scraperNameSelector", "scraperPriceSelector", "scraperUrlPattern",
  "isActive", "createdAt", "updatedAt"
)
VALUES (
  md5(random()::text || clock_timestamp()::text),
  'Macrocenter',
  'macrocenter',
  '#E3000F',
  'https://www.macrocenter.com.tr',
  'Macrocenter - Genis urun yelpazesi',
  true,
  'SITEMAP_HTML',
  'https://www.macrocenter.com.tr/hermes/api/sitemaps/sitemap.xml',
  'h1',
  '.price-no-discount, .price.subtitle-1, .price',
  '-p-',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  "scraperEnabled"       = true,
  "scraperType"          = 'SITEMAP_HTML',
  "sitemapUrl"           = 'https://www.macrocenter.com.tr/hermes/api/sitemaps/sitemap.xml',
  "scraperNameSelector"  = 'h1',
  "scraperPriceSelector" = '.price-no-discount, .price.subtitle-1, .price',
  "scraperUrlPattern"    = '-p-',
  "updatedAt"            = NOW();

-- CarrefourSA tamamen 403 (Cloudflare WAF) — scraper devre disi
UPDATE "markets"
SET "scraperEnabled" = false, "updatedAt" = NOW()
WHERE "slug" = 'carrefoursa';

-- SOK sitemap 403 — scraper devre disi
UPDATE "markets"
SET "scraperEnabled" = false, "updatedAt" = NOW()
WHERE "slug" = 'sok';
