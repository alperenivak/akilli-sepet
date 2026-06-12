-- Kupon kod modu: manuel / otomatik / hibrit (idempotent)

DO $$ BEGIN
  CREATE TYPE "RewardCodeMode" AS ENUM ('MANUAL', 'AUTO', 'HYBRID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RewardCodeSource" AS ENUM ('MANUAL', 'AUTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "community_rewards" ADD COLUMN IF NOT EXISTS "codeMode" "RewardCodeMode" NOT NULL DEFAULT 'HYBRID';
ALTER TABLE "community_rewards" ADD COLUMN IF NOT EXISTS "codePrefix" TEXT DEFAULT 'AKS';
ALTER TABLE "community_rewards" ADD COLUMN IF NOT EXISTS "autoExpiresDays" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "reward_coupon_codes" ADD COLUMN IF NOT EXISTS "source" "RewardCodeSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "reward_coupon_codes" ADD COLUMN IF NOT EXISTS "generatedForUserId" TEXT;
