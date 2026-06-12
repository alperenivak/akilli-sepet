-- Alt kategoriler (mevcut DB'ye manuel uygulama)
-- Seed calistirmadan once/sonra kullanilabilir

-- Ornek: Sut Urunleri alt kategorileri
INSERT INTO categories (id, name, slug, icon, "parentId", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v.slug, v.icon, p.id, v.ord, true, NOW(), NOW()
FROM (VALUES
  ('sut-urunleri', 'Süt', 'sut', '🥛', 1),
  ('sut-urunleri', 'Peynir', 'peynir', '🧀', 2),
  ('sut-urunleri', 'Yoğurt', 'yogurt', '🫙', 3)
) AS v(parent_slug, name, slug, icon, ord)
JOIN categories p ON p.slug = v.parent_slug
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  "parentId" = EXCLUDED."parentId",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = true;

-- Urunleri alt kategorilere tasi (ornek slug eslestirmeleri)
UPDATE products SET "categoryId" = (SELECT id FROM categories WHERE slug = 'sut')
WHERE slug IN ('pinar-tam-yaglis-sut-1lt', 'sek-yarim-yaglis-sut-1lt');

UPDATE products SET "categoryId" = (SELECT id FROM categories WHERE slug = 'peynir')
WHERE slug IN ('sutas-beyaz-peynir-400g', 'pinar-kasar-peyniri-400g');

UPDATE products SET "categoryId" = (SELECT id FROM categories WHERE slug = 'yogurt')
WHERE slug = 'danone-yogurt-500g';
