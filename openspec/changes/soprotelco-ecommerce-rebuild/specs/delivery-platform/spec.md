# Delivery Platform Specification

## Purpose

Define reproducible runtime, CI/CD, Docker parity, and review-slice delivery constraints.

## Requirements

### Requirement: Modern Docker-First Runtime

The system MUST use latest stable functional Node.js, Next.js, React, Tailwind, TypeScript, and tooling versions aligned across local, CI, and containers.

#### Scenario: Containerized app starts

- GIVEN required environment variables and PostgreSQL are available
- WHEN the application is started through Docker Compose
- THEN the web service SHALL boot against the PostgreSQL service

#### Scenario: Version drift detected

- GIVEN runtime versions differ across local metadata, CI, or container image
- WHEN validation runs
- THEN the pipeline MUST fail or report the drift before deployment

#### Scenario: Host-only script attempted

- GIVEN a deployment step depends on unreproducible host state
- WHEN delivery validation reviews the step
- THEN the step MUST be rejected or replaced with a container-safe alternative

### Requirement: CI/CD and Chained PR Gates

The system MUST gate changes with lint, typecheck, tests, build, and container validation, and delivery MUST use forced chained PRs under 400 changed lines.

#### Scenario: CI gates pass

- GIVEN a PR slice is opened
- WHEN CI runs
- THEN lint, typecheck, tests, build, and container checks SHALL pass before merge readiness

#### Scenario: PR exceeds review budget

- GIVEN a planned slice exceeds 400 changed lines
- WHEN work is prepared for review
- THEN it MUST be split into chained reviewable units unless a maintainer grants an explicit exception
