# Issue #18 release-hardening delivery chain

This draft-only integration tracker coordinates the dependency-ordered delivery
of the approved release-hardening work for [Issue #18](https://github.com/sebasttiant/websoprotelco/issues/18).
It must not merge until all child pull requests are reviewed and merged into
this branch in order.

```text
main
  └── chore/release-hardening-integration-v2 (tracker; draft/no-merge)
        └── build/release-runtime-foundation
              └── feat/release-e2e-seed-contract
                    └── feat/release-admin-responsive-navigation
                          └── feat/release-provenance-recovery
                                └── feat/release-observability-runtime
                                      └── feat/release-staging-isolation-v2
```

## Work-unit contract

Every child is a draft PR targeting its immediate predecessor. Each one includes
the runtime dependencies, tests, focused validation, and rollback boundary that
apply to that work unit. A child must be validated from its own clean worktree
and committed SHA; the preserved source worktree is not validation evidence.

| Order | Work unit | Scope | Rollback boundary |
| --- | --- | --- | --- |
| 1 | Runtime foundation | Docker/runtime, package and TypeScript isolation contracts, CI prerequisites | Revert the foundation commit |
| 2 | Seed and E2E helpers | Explicit non-production seed policy and reusable E2E admin helpers | Revert the helper/seed commit |
| 3 | Responsive admin navigation | Accessible mobile sidebar drawer and breakpoint behavior | Revert the navigation commit |
| 4 | Deploy provenance and recovery | Deploy/rollback safety, backups, intents, recovery scripts and contracts | Revert the operational safety commit |
| 5 | Observability runtime | Proxy logging, evaluator, retention worker, health readiness, Compose runtime and tests | Revert the observability commit |
| 6 | Staging isolation and final wiring | Staging topology, deterministic contract and final CI/documentation wiring | Revert the staging contract commit |

## Tracker rules

- This tracker is an integration checkpoint, not a product delivery PR.
- The child PRs remain draft until their focused clean-checkout validation passes.
- No child may reference a file introduced only by a later child.
- Any inseparable operational shell-and-test unit over 400 changed lines records
  a `size:exception` rationale in its PR body.
- Only this integration tracker/final integration semantically closes Issue #18;
  child PRs still include the required issue linkage for repository validation.

## Delivery log

The plan above is the approved intent and is kept unchanged. This section records
what each child actually delivered, so any divergence between planned and shipped
scope stays visible without rewriting the plan or the branch topology.

### Child 1 — delivered as TypeScript isolation only

| Field | Value |
| --- | --- |
| Branch | `build/release-typecheck-foundation` |
| Pull request | [#20](https://github.com/sebasttiant/websoprotelco/pull/20) (draft, targets this tracker) |
| Size | 281 additions / 4 deletions across 6 files |
| Status | CI green (`Lint, typecheck, test, build`; `Docker build and Compose validation`) |

Child 1 delivers **only** the TypeScript isolation slice of work unit 1: an
isolated `pnpm typecheck` that runs `next typegen` in a disposable, gitignored
project root, plus the foundation contract that pins its four properties and
asserts no tracked byte moves.

The branch is named `build/release-typecheck-foundation` rather than the planned
`build/release-runtime-foundation` because it carries the narrower slice. The
branch is already pushed and has an open PR, so it is not renamed.

Deferred from work unit 1, still to be delivered by later children:

- Docker and runtime foundation changes.
- CI prerequisites beyond the existing `pnpm typecheck` step — notably wiring
  `tests/foundation/typecheck-contract.sh` into CI, which currently runs only
  on demand.

Subsequent children target `build/release-typecheck-foundation` as their chain
predecessor in place of the planned `build/release-runtime-foundation`.
