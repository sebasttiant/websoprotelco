# Spec: Inventory Domain

## Requirements

### REQ-1: Stock Movements
The system MUST track all stock movements (in, out, adjustment) with:
- Product reference
- Quantity change (positive or negative)
- Movement type (sale, purchase, adjustment, return)
- Timestamp
- User who made the change
- Optional notes

### REQ-2: Current Stock Calculation
The system MUST calculate current stock by summing all movements for a product.

### REQ-3: Low Stock Alerts
The system MUST identify products below a configurable minimum stock threshold.

### REQ-4: Inventory History
The system MUST provide a paginated history of movements for a product.

## Scenarios

### Scenario 1: Record a sale
**Given** a product with 10 units in stock
**When** a sale of 3 units is recorded
**Then** stock movement is created with type "sale" and quantity -3
**And** current stock becomes 7

### Scenario 2: Record a purchase
**Given** a product with 5 units in stock
**When** a purchase of 20 units is recorded
**Then** stock movement is created with type "purchase" and quantity +20
**And** current stock becomes 25

### Scenario 3: Stock adjustment
**Given** a product with 100 units in stock
**When** an adjustment of -5 units is recorded (damage/loss)
**Then** stock movement is created with type "adjustment" and quantity -5
**And** current stock becomes 95

### Scenario 4: Low stock alert
**Given** a product with minimum stock threshold of 10
**When** current stock is 8
**Then** product appears in low stock alerts

### Scenario 5: Inventory history
**Given** a product with 5 movements
**When** admin views inventory history
**Then** paginated list shows all 5 movements with type, quantity, timestamp, user

## Data Model

### Table: stock_movements
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at DESC);
```

## Validation Rules

- `movement_type`: must be one of 'sale', 'purchase', 'adjustment', 'return'
- `quantity`: must be non-zero (positive for in, negative for out)
- `product_id`: must reference existing product
- `user_id`: optional, defaults to current session user

## Authorization

- Read inventory: requires `inventory:read` permission
- Write inventory: requires `inventory:write` permission
- Admin and staff roles have both permissions
