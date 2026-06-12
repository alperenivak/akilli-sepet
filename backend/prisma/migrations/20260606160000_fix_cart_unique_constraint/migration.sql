-- Eski (cartId, productId) unique kisitini kaldir
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'cart_items'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%"cartId"%'
      AND pg_get_constraintdef(oid) LIKE '%"productId"%'
      AND pg_get_constraintdef(oid) NOT LIKE '%"marketId"%'
  LOOP
    EXECUTE format('ALTER TABLE cart_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS "cart_items_cartId_productId_key";
ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cartId_productId_key";
ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cartId_productId_marketId_key";
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_productId_marketId_key" UNIQUE ("cartId", "productId", "marketId");
