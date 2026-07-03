# Postgres Persistence Specification

## Purpose

Define durable persistence, migrations, and import validation on latest stable PostgreSQL without Supabase runtime dependency.

## Requirements

### Requirement: Canonical PostgreSQL Model

The system MUST use PostgreSQL as the canonical persistence layer for catalog, users, roles, inventory, leads, quote/order requests, settings, banners, and documents.

#### Scenario: Domain data persists

- GIVEN valid domain data is submitted through an authorized operation
- WHEN the transaction completes
- THEN the system SHALL persist the data in PostgreSQL with required relationships intact

#### Scenario: Constraint violation

- GIVEN submitted data violates uniqueness, relationship, or required-field constraints
- WHEN persistence is attempted
- THEN the system MUST reject the write without partial domain corruption

#### Scenario: Supabase unavailable

- GIVEN no Supabase environment variables exist
- WHEN the application reads or writes domain data
- THEN normal runtime behavior MUST continue through PostgreSQL

### Requirement: Migrations and Import Checks

The system MUST manage schema changes through versioned migrations and validate any legacy import before accepting it.

#### Scenario: Migration applied

- GIVEN a target database is behind the expected schema
- WHEN migrations run
- THEN the database SHALL reach the expected version or fail fast

#### Scenario: Legacy import mismatch

- GIVEN legacy data has conflicting identifiers, tables, or required fields
- WHEN import validation runs
- THEN the system MUST report rejected records and avoid silent data loss
