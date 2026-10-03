# Disposable test databases and cleanup

F20 makes database-backed Vitest runs fail before workers start unless their database is explicitly initialized for disposable testing. Pure unit runs without database URLs do not initialize cleanup.

## Initialize a fresh database

Use a separate local PostgreSQL 16+ instance/container. The only accepted database names are `atlas_lms_test` and `atlas_lms_ci`; the host must be `localhost`, `127.0.0.1` or `::1`. Use the same host spelling, port and database in every connection. Hosted database URLs, maintenance databases, application database names and connection override parameters are rejected. Only `schema=public` is accepted as a URL query parameter.

Create the empty database using your disposable container configuration. Supply these variables to `pnpm db:test:setup`:

| Variable                      | Value                                                          |
| ----------------------------- | -------------------------------------------------------------- |
| `TEST_DATABASE_DISPOSABLE`    | `1`                                                            |
| `TEST_DATABASE_BOOTSTRAP_URL` | Owner connection to that empty local database                  |
| `TEST_DATABASE_ID`            | A new UUID for this database instance; retain it for test runs |
| `TEST_CLEANUP_PASSWORD`       | A separate password of at least 16 characters                  |

`db:test:setup` provisions the schema from migrations, seeds catalogues, and initializes the cleanup role and ownership hooks. It does not load `.env.local`, clone development, drop databases, or terminate sessions. An existing schema is refused. If you already provisioned a fresh schema with `db:provision`, use `pnpm db:test:cleanup:init` with the same variables instead. Initialization refuses existing tenants or principals and will not replace a different database marker.

Do not install `backend/prisma/sql/test-only/cleanup-registry.sql` in application environments. Normal provisioning deliberately excludes it. Use a separate test container rather than placing the privileged cleanup role in a production cluster.

## Run database tests

Configure the following in the ignored `.env.test` or test process environment:

| Variable                         | Value                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | Normal test application/fixture connection                                               |
| `PLATFORM_DATABASE_URL`          | Test platform connection, if required by the suite                                       |
| `ATLAS_APP_LOGIN_URL`            | Test RLS login, if required by the suite                                                 |
| `TEST_CLEANUP_DATABASE_URL`      | Connection to the same database as user `atlas_test_cleanup`, with the separate password |
| `TEST_DATABASE_ID`               | UUID assigned during initialization                                                      |
| `ALLOW_DESTRUCTIVE_TEST_CLEANUP` | `1`                                                                                      |

Any `F*_TEST_DATABASE_URL` must also target this same disposable database. F14/F15 private-schema tests now use this database rather than `/postgres`. Remove bootstrap credentials from the run environment. Leave `PGOPTIONS` and `TEST_RUN_ID` unset; global setup creates them. The cleanup URL must not be used as an application connection.

Run existing commands such as `pnpm test:db` or `pnpm test:tenant-isolation`. Each invocation receives a fresh UUID. Normal `pg` connections inherit it through `PGOPTIONS`; test-specific pools must not overwrite that option. Database hooks record inserted tenant and principal IDs in the same transaction. Setup removes cleanup/bootstrap credentials from the worker environment and retains the cleanup connection only in its teardown closure.

Fixture code is trusted code, not an adversarial sandbox. Do not embed alternate database credentials in tests, disable the ownership hooks, or override connection startup options. New test connection mechanisms must preserve the same preflight and run identity.

## Cleanup behavior and recovery

Cleanup verifies the connected database name, non-superuser cleanup login and database UUID marker inside a transaction. It locks the run, selects its recorded tenant IDs, and checks protected tenant names. It never sweeps by slug patterns. Related tenant rows are removed only for those IDs. Trigger bypass is limited to this verified disposable transaction and is reset before principal cleanup.

Existing tenants/principals and other runs are preserved. Reused UUIDs do not inherit stale ownership; tracked UUID changes are rejected. Principals with remaining memberships are retained. Other foreign-key references, including cascading operator grants, refuse cleanup and roll back the entire transaction. There is no automatic sweep of tenantless global audit or cost records; fixtures must clean their own global records by exact IDs/run markers. Private-schema tests retain responsibility for dropping their own random schemas.

A cleanup failure is printed and explicitly sets a nonzero process exit code, even if all test assertions passed. The run remains available for investigation. Record its UUID from the test output and inspect the reported reference or permission problem. Resolve only that run's fixtures before retrying:

```text
pnpm db:cleanup-test-tenants --run-id <run-uuid>
pnpm db:cleanup-test-tenants --run-id <run-uuid> --apply
```

Both preview and apply require the explicit cleanup environment above; this CLI no longer loads development credentials. Preview counts candidates but does not guarantee apply will succeed when global references block principal deletion. A successful repeat cleanup removes zero rows. Writes using a closed run are rejected. If the test process is killed before teardown, use its recorded run UUID for recovery or discard that dedicated container after inspecting it.

## Regression verification

- `pnpm test:cleanup-boundary`: URL, authorization and preflight refusal tests, without a database.
- `pnpm test:cleanup-postgres`: requires a fresh PostgreSQL 17 fixture at `127.0.0.1:15440`, database `atlas_lms_test`, owner `postgres`, password `atlas_f20_disposable_only`. These are disposable verification credentials only. The script refuses a nonempty public schema and never resets existing data.

The PostgreSQL verifier exercises actual fixture hooks, multiple runs, rollback, UUID reuse, protected tenants, cascading global references and the real Vitest worker/teardown lifecycle. CI creates its isolated service automatically. Five database-backed Vitest jobs initialize their own cleanup markers after schema provisioning; bootstrap credentials are scoped to initialization, with only cleanup configuration passed to test invocations.
