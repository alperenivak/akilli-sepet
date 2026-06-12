-- Sepet kalemlerine market bilgisi ekle
ALTER TABLE "cart_items" ADD COLUMN "marketId" TEXT;
ALTER TABLE "cart_items" ADD COLUMN "unitPrice" INTEGER;

-- Mevcut kayitlari en ucuz markete ata
UPDATE "cart_items" ci
SET
  "marketId" = sub."marketId",
  "unitPrice" = sub."amount"
FROM (
  SELECT DISTINCT ON (ci2.id)
    ci2.id AS item_id,
    p."marketId",
    p."amount"
  FROM "cart_items" ci2
  JOIN "prices" p ON p."productId" = ci2."productId" AND p."isAvailable" = true
  ORDER BY ci2.id, p."amount" ASC
) sub
WHERE ci.id = sub.item_id;

-- Market atanamayan kalemleri kaldir
DELETE FROM "cart_items" WHERE "marketId" IS NULL;

ALTER TABLE "cart_items" ALTER COLUMN "marketId" SET NOT NULL;

DROP INDEX IF EXISTS "cart_items_cartId_productId_key";
ALTER TABLE "cart_items" DROP CONSTRAINT IF EXISTS "cart_items_cartId_productId_key";
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_productId_marketId_key" UNIQUE ("cartId", "productId", "marketId");
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "cart_items_marketId_idx" ON "cart_items"("marketId");
