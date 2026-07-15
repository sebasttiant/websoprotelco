# Admin E2E Specification

## Purpose

Define Playwright smoke coverage for legacy-parity admin confidence without executing tests during specification work.

## Requirements

### Requirement: Admin Smoke Coverage

The system MUST include Playwright smoke coverage for login, navigation, RBAC, orders, dashboard, and inventory display using stable accessible selectors.

#### Scenario: Authorized admin smoke path
- GIVEN an authorized admin account and compatible test data
- WHEN the smoke test logs in and navigates admin modules
- THEN dashboard, orders, products, and inventory surfaces load successfully
- AND the orders metric is visible

#### Scenario: Unauthorized user is blocked
- GIVEN a user lacking admin/order permission
- WHEN the smoke test attempts admin/order access
- THEN access is denied without sensitive data exposure

### Requirement: Orders E2E Behavior

The E2E suite MUST verify order creation from active products, stale-price conflict display, explicit reconfirmation, and conditional status update feedback.

#### Scenario: Create order from active product
- GIVEN an active COP product is available
- WHEN the admin creates an order through the UI
- THEN the order detail shows server-snapshotted values
- AND no tax line is added automatically

#### Scenario: Stale price requires reconfirmation
- GIVEN the displayed price becomes stale before submission
- WHEN the admin submits the order
- THEN the UI shows the conflict
- AND creation requires explicit reconfirmation

### Requirement: Delivery and Review Guardrails

The E2E work MUST stay with the slice it verifies, MUST preserve P1-P5 checkpoints, and MUST keep each chained implementation slice at or under the 400 changed-line review budget unless explicitly exempted.

#### Scenario: Slice remains reviewable
- GIVEN a planned E2E/admin slice risks exceeding 400 changed lines
- WHEN tasks are prepared
- THEN the work is split into chained review units
- AND each unit has its own acceptance and rollback boundary

#### Scenario: Migration-compatible smoke data
- GIVEN production reset, seed, deploy, and migration execution are forbidden in this phase
- WHEN E2E acceptance is specified
- THEN tests rely on controlled compatible fixtures or existing safe setup
- AND no spec requires destructive environment operations
