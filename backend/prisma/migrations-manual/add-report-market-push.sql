ALTER TABLE reports ADD COLUMN IF NOT EXISTS "marketNameOther" TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS "pushedToMarketAt" TIMESTAMP(3);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS "pushedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_pushedById_fkey'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT "reports_pushedById_fkey"
      FOREIGN KEY ("pushedById") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
