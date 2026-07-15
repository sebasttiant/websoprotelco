# Inventory Consistency Specification

## Purpose

Make `stock_movements` the canonical inventory source while preserving legacy-visible stock display and safe reconciliation.

## Requirements

### Requirement: Ledger Canonical Stock

The system MUST treat the inventory ledger as canonical, MUST reconcile `products.stock_quantity` from ledger totals, and MUST NOT allow normal write paths to mutate scalar stock independently.

#### Scenario: Stock display matches ledger
- GIVEN product ledger movements total to quantity Q
- WHEN admin inventory is displayed
- THEN the visible stock equals Q
- AND scalar stock does not contradict the ledger

#### Scenario: Direct scalar drift is reconciled
- GIVEN `products.stock_quantity` differs from ledger total
- WHEN reconciliation runs
- THEN scalar stock is corrected to the ledger value
- AND ledger rows are preserved

### Requirement: Inventory Mutation Consistency

The system MUST represent inventory-affecting actions as ledger movements and MUST keep order, catalog, and dashboard inventory reads consistent with that ledger.

#### Scenario: Order stock impact is ledger-backed
- GIVEN an order transition affects inventory
- WHEN the transition succeeds
- THEN the corresponding stock movement exists
- AND all admin inventory views reflect the same quantity

#### Scenario: Failed action leaves no partial stock change
- GIVEN an inventory-affecting order action fails validation or authorization
- WHEN the action is rejected
- THEN no ledger movement or scalar stock change is persisted

### Requirement: Reconciliation Safety and Rollback

The reconciliation flow MUST be idempotent, auditable, and reversible only by restoring UI/write-path behavior while preserving ledger history.

#### Scenario: Reconciliation is idempotent
- GIVEN reconciliation already aligned scalar stock to ledger totals
- WHEN reconciliation runs again
- THEN no extra movement rows are created
- AND displayed stock remains unchanged

#### Scenario: Inventory backout preserves ledger
- GIVEN the inventory slice is rolled back
- WHEN the previous UI/write behavior is restored
- THEN existing `stock_movements` rows remain intact
- AND no production reset or seed is required
