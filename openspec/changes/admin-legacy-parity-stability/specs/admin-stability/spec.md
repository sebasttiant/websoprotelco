# Admin Stability Specification

## Purpose

Stabilize destructive actions, conditional updates, dashboard behavior, and Spanish/mobile legacy parity without changing quote semantics.

## Requirements

### Requirement: Destructive Action Confirmation

The system MUST require an explicit confirmation step before destructive admin actions and MUST make cancellation non-destructive.

#### Scenario: Confirmed delete proceeds
- GIVEN an admin initiates a destructive action
- WHEN the admin confirms intentionally
- THEN the action executes once
- AND success or failure is reported accessibly

#### Scenario: Cancel preserves data
- GIVEN a destructive confirmation is open
- WHEN the admin cancels or dismisses it
- THEN no data is deleted or modified

### Requirement: Conditional Update Resilience

The system MUST use conditional updates for quote and order status changes and MUST preserve quote isolation and existing quote states.

#### Scenario: Quote state remains isolated
- GIVEN an existing quote in any supported quote state
- WHEN order features are used
- THEN the quote state machine is unchanged

#### Scenario: Stale admin update is rejected
- GIVEN two admins edit the same status-bearing record
- WHEN one saves after the record changed
- THEN the stale update is rejected
- AND the current state can be reloaded

### Requirement: Dashboard Legacy Parity

The admin dashboard MUST expose the orders metric and inventory display consistently with legacy Spanish/mobile expectations while avoiding misleading fiscal claims.

#### Scenario: Dashboard shows order metric
- GIVEN persisted orders exist
- WHEN an authorized admin opens the dashboard
- THEN the dashboard displays the current orders metric
- AND quotes are not counted as orders

#### Scenario: Mobile Spanish parity is preserved
- GIVEN an admin uses a mobile viewport in Spanish UI context
- WHEN navigating dashboard, orders, products, and inventory
- THEN labels, layout, and primary actions remain usable and legacy-aligned

### Requirement: Accessibility and Backout Acceptance

The admin UI MUST provide keyboard-operable controls, accessible names/status messages, and per-slice rollback without breaking the P1-P5 checkpoint.

#### Scenario: Keyboard and screen-reader flow works
- GIVEN an admin uses keyboard navigation
- WHEN creating an order or confirming a destructive action
- THEN focus order, labels, and status feedback are accessible

#### Scenario: Slice rollback is bounded
- GIVEN a slice fails acceptance
- WHEN the slice is backed out
- THEN P1-P5 remains green
- AND unrelated admin modules continue working
