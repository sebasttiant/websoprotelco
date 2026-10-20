-- Migration 0015: Promotions and featured ("Top") products, managed from the admin.
--
-- promo_price_cents is the REAL price a customer pays while it is set: the storefront,
-- the cart and the server-side order repricing all use COALESCE(promo_price_cents,
-- price_cents). The CHECK makes a meaningless "promotion" (promo >= list price, or a
-- zero/negative promo) impossible at the database level, not only in form validation.
-- is_featured is the admin-controlled "Top" flag that, together with promotions,
-- feeds the home "Promociones y destacados" section.
--
-- Additive only: existing rows get no promotion and no flag, so storefront behavior
-- is unchanged until an administrator opts a product in.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS promo_price_cents bigint
    CHECK (promo_price_cents IS NULL OR (promo_price_cents > 0 AND promo_price_cents < price_cents)),
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_promoted_idx
  ON products (is_featured, promo_price_cents)
  WHERE is_active = true;
