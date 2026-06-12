-- E-posta dogrulama: emailVerified + OTP tablosu

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Mevcut kullanicilar dogrulanmis kabul edilir
UPDATE "users" SET "emailVerified" = true WHERE "emailVerified" = false;

CREATE TABLE IF NOT EXISTS "email_otps" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_otps_email_purpose_idx" ON "email_otps"("email", "purpose");
CREATE INDEX IF NOT EXISTS "email_otps_expiresAt_idx" ON "email_otps"("expiresAt");
