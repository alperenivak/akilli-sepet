-- Itibar sistemi: olay gecmisi + fiyat geri bildirimi tekilligi

DO $$ BEGIN
  CREATE TYPE "ReputationEventType" AS ENUM (
    'VERIFY_CORRECT',
    'VERIFY_INCORRECT',
    'SUBMIT_PRICE',
    'SUBMIT_APPROVED',
    'SUBMIT_REJECTED',
    'SUBMIT_AUTO_APPROVED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "reputation_events" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ReputationEventType" NOT NULL,
  "points" DOUBLE PRECISION NOT NULL,
  "scoreAfter" DOUBLE PRECISION NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reputation_events_userId_createdAt_idx"
  ON "reputation_events"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Ayni fiyat icin tekrar oy verilmesini engelle
DO $$ BEGIN
  ALTER TABLE "price_feedbacks" ADD CONSTRAINT "price_feedbacks_userId_priceId_key"
    UNIQUE ("userId", "priceId");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
