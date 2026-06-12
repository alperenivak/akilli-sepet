-- PostgreSQL full-text search for products (Turkish + relevance ranking)

ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('turkish', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('turkish', coalesce(NEW.brand, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.keywords, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, brand, keywords ON products
  FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

UPDATE products SET search_vector =
  setweight(to_tsvector('turkish', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('turkish', coalesce(brand, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(keywords, ' '), '')), 'C');

CREATE INDEX IF NOT EXISTS products_search_vector_gin_idx ON products USING GIN (search_vector);
