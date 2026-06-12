-- Topluluk ödülleri — itibar karşılığı market kuponları

CREATE TABLE "community_rewards" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "benefitText" TEXT NOT NULL,
    "discountLabel" TEXT NOT NULL,
    "minReputation" DOUBLE PRECISION NOT NULL,
    "levelLabel" TEXT NOT NULL,
    "levelIcon" TEXT NOT NULL,
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "marketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reward_coupon_codes" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_coupon_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_reward_claims" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reward_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_rewards_slug_key" ON "community_rewards"("slug");
CREATE INDEX "community_rewards_minReputation_idx" ON "community_rewards"("minReputation");
CREATE INDEX "community_rewards_isActive_idx" ON "community_rewards"("isActive");

CREATE UNIQUE INDEX "reward_coupon_codes_code_key" ON "reward_coupon_codes"("code");
CREATE INDEX "reward_coupon_codes_rewardId_isUsed_idx" ON "reward_coupon_codes"("rewardId", "isUsed");

CREATE UNIQUE INDEX "user_reward_claims_codeId_key" ON "user_reward_claims"("codeId");
CREATE UNIQUE INDEX "user_reward_claims_userId_rewardId_key" ON "user_reward_claims"("userId", "rewardId");
CREATE INDEX "user_reward_claims_userId_idx" ON "user_reward_claims"("userId");

ALTER TABLE "community_rewards" ADD CONSTRAINT "community_rewards_marketId_fkey"
    FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reward_coupon_codes" ADD CONSTRAINT "reward_coupon_codes_rewardId_fkey"
    FOREIGN KEY ("rewardId") REFERENCES "community_rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reward_claims" ADD CONSTRAINT "user_reward_claims_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reward_claims" ADD CONSTRAINT "user_reward_claims_rewardId_fkey"
    FOREIGN KEY ("rewardId") REFERENCES "community_rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_reward_claims" ADD CONSTRAINT "user_reward_claims_codeId_fkey"
    FOREIGN KEY ("codeId") REFERENCES "reward_coupon_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
