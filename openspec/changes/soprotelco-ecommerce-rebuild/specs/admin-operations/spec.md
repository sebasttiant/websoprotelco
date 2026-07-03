# Admin Operations Specification

## Purpose

Define back-office capabilities for managing catalog, inventory, commercial requests, content, users, and settings.

## Requirements

### Requirement: Admin Management Coverage

The system MUST provide authorized admin operations for products, categories, inventory, leads, quotes/orders, users, settings, banners/design, and documents.

#### Scenario: Authorized admin updates catalog

- GIVEN an authenticated admin has catalog permission
- WHEN the admin creates or edits a product or category
- THEN the system SHALL persist the change and make it available to storefront reads

#### Scenario: Inventory movement recorded

- GIVEN an authenticated admin has inventory permission
- WHEN stock is adjusted
- THEN the system MUST record the resulting quantity and movement history

#### Scenario: Unauthorized admin operation

- GIVEN a user lacks permission for an admin operation
- WHEN the user attempts the operation
- THEN the system MUST deny the action and avoid changing data

### Requirement: Commercial Workflow Administration

The system MUST allow authorized staff to review leads and quote/order requests through lifecycle states.

#### Scenario: Staff updates request state

- GIVEN a quote/order request exists
- WHEN authorized staff changes its status
- THEN the system SHALL record the new state for operational follow-up

#### Scenario: Invalid status transition

- GIVEN a transition is not allowed by the request workflow
- WHEN staff submits the transition
- THEN the system MUST reject it with an actionable error
