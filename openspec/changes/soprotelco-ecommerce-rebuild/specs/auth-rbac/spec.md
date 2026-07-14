# Auth RBAC Specification

## Purpose

Define first-party authentication and role-based authorization for customer and admin areas.

## Requirements

### Requirement: First-Party Sessions

The system MUST provide first-party authentication backed by the application persistence layer and MUST NOT depend on Supabase at runtime.

#### Scenario: User signs in

- GIVEN valid credentials for an active account
- WHEN the user signs in
- THEN the system SHALL create a secure session and route the user to the permitted area

#### Scenario: Invalid credentials

- GIVEN credentials are invalid or the account is disabled
- WHEN sign-in is attempted
- THEN the system MUST reject the attempt without creating a session

#### Scenario: Supabase dependency absent

- GIVEN the application starts in any environment
- WHEN authentication code executes
- THEN it MUST NOT require Supabase client, service keys, or Supabase Auth helpers

### Requirement: Server-Enforced RBAC

The system MUST enforce authorization on server-side operations and MUST NOT rely on frontend-only checks or hard-coded admin bypasses.

#### Scenario: Permitted action

- GIVEN an authenticated user has the required role or permission
- WHEN the user invokes a protected operation
- THEN the system SHALL allow the operation

#### Scenario: Hard-coded bypass attempt

- GIVEN a user matches a legacy bypass identifier or manipulates client state
- WHEN the user invokes an admin operation without permission
- THEN the system MUST deny the operation
