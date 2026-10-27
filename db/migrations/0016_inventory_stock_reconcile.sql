-- Align the stock_movements ledger with products.stock_quantity after dual-write drift.
-- Catalog admin showed the scalar column; inventory screens summed the ledger. Quick ±
-- on /admin/products wrote ledger rows without updating the scalar, so the two views
-- disagreed. This idempotent opening adjustment closes the gap once; subsequent
-- movements keep both in sync in application code.

INSERT INTO stock_movements (product_id, movement_type, quantity, notes)
SELECT
  p.id,
  'adjustment',
  p.stock_quantity - COALESCE(ledger.total, 0),
  'Reconciliation: align ledger to products.stock_quantity'
FROM products p
LEFT JOIN (
  SELECT product_id, SUM(quantity)::integer AS total
  FROM stock_movements
  GROUP BY product_id
) AS ledger ON ledger.product_id = p.id
WHERE p.stock_quantity - COALESCE(ledger.total, 0) <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM stock_movements m
    WHERE m.product_id = p.id
      AND m.notes = 'Reconciliation: align ledger to products.stock_quantity'
  );
