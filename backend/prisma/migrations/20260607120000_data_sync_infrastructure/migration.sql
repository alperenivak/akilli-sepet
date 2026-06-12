-- Veri senkronizasyonu altyapisi: fiyat dogrulama bayragi + sync log tablosu

ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "needsVerification" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "prices" ALTER COLUMN "source" SET DEFAULT 'MANUAL_ADMIN';

CREATE TABLE IF NOT EXISTS "data_sync_logs" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsTotal" INTEGER NOT NULL DEFAULT 0,
    "recordsSuccess" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "data_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "data_sync_logs_jobType_idx" ON "data_sync_logs"("jobType");
CREATE INDEX IF NOT EXISTS "data_sync_logs_startedAt_idx" ON "data_sync_logs"("startedAt");

CREATE INDEX IF NOT EXISTS "prices_lastUpdated_idx" ON "prices"("lastUpdated");
