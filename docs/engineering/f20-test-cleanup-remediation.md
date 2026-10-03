# F20 — Destructive test cleanup boundary

Implemented and locally verified on 2026-09-20. No development or hosted application database was modified for this work.

## Finding and result

The previous global teardown used `DATABASE_URL`, selected tenants by slug patterns, bypassed triggers, and reduced cleanup errors to warnings. The replacement requires explicit authorization, a dedicated cleanup login, a strict disposable database address, and a database-side UUID marker. The test runner refuses unsafe configuration before starting workers.

Cleanup now selects database-recorded fixture IDs owned by one run. It preserves pre-existing test-looking tenants, concurrent runs and existing principals. Registry hooks handle fixture deletion/reinsertion and prevent stale UUID ownership. Principal cleanup checks all foreign-key references, including cascades; a conflicting reference aborts and rolls back cleanup. Shared principals with remaining memberships are explicitly reported as retained.

An actual runner test uncovered that Vitest 4.1.11 can log a thrown global teardown error yet exit zero. Teardown now explicitly sets a failure exit code as well as rethrowing. The regression verifier proves this with a passing test whose cleanup is deliberately blocked.

## Implementation

- `scripts/db/test-cleanup-boundary.mjs`: target, authorization, login and marker validation; no application credential fallback.
- `scripts/db/initialize-test-cleanup.mjs` and `backend/prisma/sql/test-only/cleanup-registry.sql`: explicit empty-test initialization, separate non-superuser cleanup role, private run registry and ownership hooks. This SQL is excluded from application provisioning.
- `scripts/db/test-cleanup-run.mjs` and `tests/global-teardown.ts`: per-run IDs, enabled-hook verification, worker credential separation, teardown with visible failure.
- `scripts/db/purge-test-tenants.mjs`: transactional run-specific cleanup, protected-name backstop, rollback on error and explicit CLI run ID.
- `scripts/db/setup-test-db.mjs`: replaces the old implicit drop/recreate and development-schema clone with fresh-only provisioning. The cleanup CLI no longer loads `.env.local`; `test:rls` uses `.env.test`.
- CI initializes dedicated cleanup identities in the five database-backed Vitest jobs and runs separate guard and real-PostgreSQL verification. F14/F15 private-schema fixtures accept the approved disposable database names. Cost fixture cleanup uses its unique run reason instead of a broad prefix match.

## Verification evidence

- 11 boundary/preflight tests passed without any database connection.
- All 18 PostgreSQL/Vitest verification checks passed in a fresh PostgreSQL 17 container bound to `127.0.0.1:15440`. Covered wrong targets/markers, missing opt-in, ownership, other-run preservation, protected names, shared identities, repeat cleanup, rollback, stale UUIDs, closed-run writes, registry permissions, cascading references, worker tracking/credential isolation and nonzero exit on cleanup failure.
- Broad unit/CI contract run: 2,517 passed; one Prisma generation subprocess timed out during parallel execution. Its focused rerun passed all 3 tests. The broad run itself is not recorded as wholly green.
- Fresh-only setup passed against a second disposable PostgreSQL 17 instance on port 15441: full LMS migrations, 146 catalogue seed rows, and cleanup identity initialization. The four changed database fixture suites then passed all 20 tests with guarded teardown.
- Targeted TypeScript checking, ESLint, formatting and SQL placement checks passed.
- F20 files received independent code review; both ownership findings were fixed and reproduced by the database regression checks.

The dedicated verifier uses a minimal real schema to isolate cleanup behavior; the four fixture suites also ran against the fully provisioned LMS schema. These checks do not represent the complete application integration suite or hosted CI execution. No application build or production deployment is required by this tooling change.

## Operating requirements

Existing local database test environments must follow [the setup and recovery runbook](../runbooks/test-database-cleanup.md). Unsafe or uninitialized database runs now fail deliberately. CI supplies its setup automatically.

Tenantless global records are not inferred to be test-owned; fixture-specific cleanup must use exact IDs/run markers. This boundary protects against accidental environment targeting and broad cleanup, and assumes trusted test code. It does not sandbox arbitrary test code with independently supplied credentials. The disposable PostgreSQL verification service is stopped after validation.
