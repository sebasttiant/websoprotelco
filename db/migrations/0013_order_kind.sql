-- Pedidos and Cotizaciones are ONE domain, not two.
--
-- The legacy app stored both in a single `orders` table discriminated by a `type` column
-- ('order' | 'quote'); `admin/pedidos` filtered on 'order' and `admin/cotizaciones` on 'quote'.
-- quote_requests already has that exact shape, so Pedidos is a discriminator here too rather
-- than a parallel table. A second table would duplicate the status machine, the reference
-- generator and every query, and would need reconciling the day a quote becomes an order.
--
-- Existing rows are all quotes: 'quote' is the default precisely so this backfills correctly.
ALTER TABLE quote_requests
  ADD COLUMN kind text NOT NULL DEFAULT 'quote' CHECK (kind IN ('quote', 'order'));

-- Every list in the admin is scoped by kind and ordered by recency, so the index leads with it.
CREATE INDEX quote_requests_kind_created_at_idx ON quote_requests (kind, created_at DESC);

-- Line totals must be a SNAPSHOT, never a join to products.
--
-- products.price_cents changes over time. Joining it would silently rewrite the total of every
-- historical order the moment someone edits a price, so an order confirmed at $699.000 could
-- later display $750.000 and no longer match what the customer agreed to. The item therefore
-- carries the price and the name as they were when the line was created.
--
-- Nullable with no default on purpose: existing quote_request_items predate this column and
-- have no honest price to record. A 0 default would look like a real "free" line in the totals.
ALTER TABLE quote_request_items
  ADD COLUMN unit_price_cents bigint CHECK (unit_price_cents >= 0),
  ADD COLUMN product_name text;
