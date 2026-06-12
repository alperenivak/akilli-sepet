-- CarrefourSA ve A101 sitemap scraper yapilandirmasi

UPDATE "markets" SET
  "scraperEnabled" = true,
  "scraperType" = 'SITEMAP_HTML',
  "sitemapUrl" = 'https://www.carrefoursa.com/sitemap.xml',
  "scraperNameSelector" = 'h1',
  "scraperPriceSelector" = '.price, .product-price, .sales-price',
  "scraperUrlPattern" = '-p-'
WHERE "slug" = 'carrefoursa';

UPDATE "markets" SET
  "scraperEnabled" = true,
  "scraperType" = 'SITEMAP_HTML',
  "sitemapUrl" = 'https://www.a101.com.tr/sitemap.xml',
  "scraperNameSelector" = 'h1',
  "scraperPriceSelector" = '.price',
  "scraperUrlPattern" = '_p-'
WHERE "slug" = 'a101';
