-- Crowdsource fiyat bildirimi sistemi
-- Katmanli veri guvenilirlik modeli

-- 1. Price tablosuna seed ve confidence alanlari ekle
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "isSeedData" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- 2. User tablosuna itibar skoru ekle
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- 3. SubmissionStatus enum olustur
DO $$ BEGIN
  CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. PriceSubmission tablosu olustur
CREATE TABLE IF NOT EXISTS "price_submissions" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "marketId" TEXT NOT NULL,
  "userId" TEXT,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "priceId" TEXT,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "adminNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_submissions_pkey" PRIMARY KEY ("id")
);

-- 5. Indexler
CREATE INDEX IF NOT EXISTS "price_submissions_productId_marketId_idx" ON "price_submissions"("productId", "marketId");
CREATE INDEX IF NOT EXISTS "price_submissions_userId_idx" ON "price_submissions"("userId");
CREATE INDEX IF NOT EXISTS "price_submissions_status_idx" ON "price_submissions"("status");
CREATE INDEX IF NOT EXISTS "price_submissions_createdAt_idx" ON "price_submissions"("createdAt");

-- 6. Foreign key kisitlamalari
DO $$ BEGIN
  ALTER TABLE "price_submissions" ADD CONSTRAINT "price_submissions_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "price_submissions" ADD CONSTRAINT "price_submissions_marketId_fkey"
    FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "price_submissions" ADD CONSTRAINT "price_submissions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "price_submissions" ADD CONSTRAINT "price_submissions_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "price_submissions" ADD CONSTRAINT "price_submissions_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
