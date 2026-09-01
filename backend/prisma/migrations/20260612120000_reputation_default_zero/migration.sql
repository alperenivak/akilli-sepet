-- Yeni kullanıcılar 0 itibar ile başlasın; katkısız eski kayıtları düzelt
ALTER TABLE "users" ALTER COLUMN "reputationScore" SET DEFAULT 0;

UPDATE "users" u
SET "reputationScore" = 0
WHERE u."reputationScore" = 1.0
  AND NOT EXISTS (SELECT 1 FROM "reputation_events" e WHERE e."userId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "price_feedbacks" f WHERE f."userId" = u.id)
  AND NOT EXISTS (SELECT 1 FROM "price_submissions" s WHERE s."userId" = u.id);
