-- Admin catalog fields for product imagery, brand metadata, stock, and category ordering.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0);

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

UPDATE categories
SET display_order = position
WHERE display_order = 0 AND position <> 0;

CREATE INDEX IF NOT EXISTS categories_display_order_idx ON categories (display_order, name);
CREATE INDEX IF NOT EXISTS products_is_active_created_at_idx ON products (is_active, created_at DESC);
