-- Ihbar notlarini kanallara ayir: kullanici vs market
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "userNote" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "marketNote" TEXT;

-- Mevcut adminNote verisini en iyi tahminle tasima
UPDATE "reports"
SET "userNote" = "adminNote"
WHERE "adminNote" IS NOT NULL
  AND "status" IN ('APPROVED', 'REJECTED', 'RESOLVED');

UPDATE "reports"
SET "marketNote" = "adminNote"
WHERE "adminNote" IS NOT NULL
  AND "pushedToMarketAt" IS NOT NULL
  AND "userNote" IS NULL;

UPDATE "reports"
SET "marketNote" = "adminNote"
WHERE "adminNote" IS NOT NULL
  AND "pushedToMarketAt" IS NOT NULL
  AND "marketNote" IS NULL
  AND "status" NOT IN ('APPROVED', 'REJECTED', 'RESOLVED');

ALTER TABLE "reports" DROP COLUMN IF EXISTS "adminNote";
