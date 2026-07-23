# Orders Specification

## Purpose

Define legacy-parity Pedidos behavior while keeping Orders isolated from Quotes and preserving the green P1-P5 checkpoint.

## Requirements

### Requirement: Persistent Order Domain and RBAC

The system MUST persist orders and order items separately from `quote_requests`, expose Orders as a separate admin module, and authorize access with `order:read` and `order:write` for admin/staff only.

#### Scenario: Authorized admin creates an order
- GIVEN an admin with `order:write` and active existing products
- WHEN the admin creates an order
- THEN the system persists an order with item snapshots
- AND quote records and quote states remain unchanged

#### Scenario: Unauthorized access is denied
- GIVEN a user without `order:read`
- WHEN the user opens the Orders admin route
- THEN access is denied without exposing order data

### Requirement: COP Server Price Snapshots

The system MUST accept only active existing products, MUST snapshot product name, SKU, unit price, and COP currency on the server, and MUST reject client-controlled price, currency, tax, discount, or manual-line input. The system MUST calculate `subtotal=total` and MUST NOT apply automatic VAT/tax.

#### Scenario: Server snapshots COP price
- GIVEN an active COP product with a current server price
- WHEN an order item is submitted by product ID and quantity
- THEN the stored item uses the server product snapshot
- AND subtotal and total match quantity times unit price

#### Scenario: Invalid item input is rejected
- GIVEN an inactive, missing, non-COP, or client-priced item
- WHEN order creation is submitted
- THEN the system rejects the order atomically

### Requirement: Stale Price Reconfirmation

The system MUST detect stale displayed prices and require explicit admin reconfirmation before persisting the order at the latest server price.

#### Scenario: Stale price blocks creation
- GIVEN the admin reviewed price A and the server price is now B
- WHEN the admin submits without reconfirming B
- THEN no order is created
- AND the response identifies the stale-price conflict

#### Scenario: Explicit reconfirmation succeeds
- GIVEN a stale-price conflict showing latest price B
- WHEN the admin explicitly reconfirms B
- THEN the order is created using B only

### Requirement: Atomic Order Status Transitions

The system MUST change order status only through allowed atomic transitions and MUST reject stale or invalid transitions without partial updates.

#### Scenario: Allowed transition succeeds
- GIVEN an order in a valid source status
- WHEN an admin applies an allowed next status
- THEN the order status changes once atomically

#### Scenario: Concurrent transition loses safely
- GIVEN two admins view the same order status
- WHEN both submit different transitions
- THEN only the first valid conditional update succeeds
- AND the loser receives a stale-state error

### Requirement: Migration Compatibility and Backout

The orders schema MUST be backward-compatible during deployment, MUST use compensating forward migrations after application, and MUST preserve/export existing order data before any reversal.

#### Scenario: Backout before orders exist
- GIVEN the migration was applied only in disposable local/test data
- WHEN backout is needed before real orders exist
- THEN dropping local-only migrations is allowed

#### Scenario: Backout after orders exist
- GIVEN persisted orders exist
- WHEN rollback is required
- THEN data is preserved/exported
- AND reversal uses a forward migration, not an edit/reset
