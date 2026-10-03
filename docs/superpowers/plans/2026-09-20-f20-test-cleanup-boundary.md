# F20 test cleanup boundary implementation plan

> Use subagent-driven-development for bounded fixture mapping and independent review. Preserve F01–F19 changes; do not commit or touch hosted databases.

**Goal:** refuse destructive cleanup outside an explicitly initialized disposable database and delete only fixtures owned by the current test run.

**Architecture:** a dedicated cleanup URL/role, strict loopback/database-name checks and a database-side identity marker replace use of application credentials. Test-only insert triggers register created tenant/principal IDs against a run UUID carried on test connections. Cleanup verifies identity and ownership in its transaction before disabling test-database triggers. Ordinary unit runs have no cleanup connection; database runs require explicit setup and fail visibly if unsafe or cleanup fails.

**Stack:** Node/pg, PostgreSQL, Vitest global setup, existing CI services.

- [x] Map fixture connections and CI jobs; prove unsafe defaults with isolated tests.
- [x] Implement URL/identity/authorization guards, explicit disposable bootstrap, and ownership registry with tests.
- [x] Replace slug-based purge with transactional current-run ID cleanup and safe reporting; preserve other runs and pre-existing data.
- [x] Wire Vitest setup/teardown and cleanup credential separation; validate worker propagation and fail-closed teardown.
- [x] Update CLI scripts, CI initialization and documentation. Remove development-env cleanup defaults.
- [x] Exercise real PostgreSQL positive/negative/concurrent/error cases, structural checks and TypeScript; obtain independent review and stop disposable services.

The user's request to implement F20 authorizes its existing audit specification. Subscription changes, hosted mutations and deletion of development data are outside this task.
