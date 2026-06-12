-- Eski (cartId, productId) unique INDEX kaldirildi — constraint degil index olarak olusturulmustu
DROP INDEX IF EXISTS "cart_items_cartId_productId_key";
