# Quote Order Commerce Specification

## Purpose

Model ecommerce as quote/order-request commerce by default, excluding online payments from the first release.

## Requirements

### Requirement: Request-Based Checkout

The system MUST convert cart contents and customer contact details into a quote or order request without collecting online payment.

#### Scenario: Customer submits request

- GIVEN a cart contains valid items and required contact details
- WHEN the customer submits checkout
- THEN the system SHALL create a request with line items and customer data
- AND the customer SHOULD receive a confirmation state

#### Scenario: Missing contact details

- GIVEN a cart contains valid items
- WHEN checkout is submitted without required contact information
- THEN the system MUST reject the request with field-level validation feedback

#### Scenario: Payment attempted

- GIVEN online payments are out of scope
- WHEN a user reaches checkout
- THEN the system MUST NOT present card, gateway, or payment-capture flows

### Requirement: Handoff Channels

The system SHOULD support operational handoff through configured email or WhatsApp channels after a valid request is created.

#### Scenario: Handoff succeeds

- GIVEN a request was created and a handoff channel is configured
- WHEN the confirmation flow completes
- THEN the system SHOULD provide the appropriate email or WhatsApp handoff

#### Scenario: Handoff unavailable

- GIVEN no handoff channel is configured
- WHEN a request is created
- THEN the system MUST still persist the request and show next-contact guidance
