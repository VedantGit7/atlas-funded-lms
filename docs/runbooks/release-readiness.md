# Release Readiness Runbook (ATL-STORY-045)

## Purpose

Prove MVP readiness with integrated security, tenant isolation, authorization, E2E wiring, and release gates **without** auto-approving production.

## Automated suite

```bash
pnpm release:suite
```

Writes `release-evidence.json` with:

- `verdict`: `NOT_READY` | `READY_FOR_STAGING` | `READY_FOR_PRODUCTION_REVIEW`
- `productionApproved`: always `false`
- automated gate results and manual gate placeholders

### Local flags

| Flag              | Effect                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| `--skip-db`       | Skips DB-backed integration, tenant isolation, RLS, migrate, seed checks |
| `--skip-build`    | Skips production build                                                   |
| `--skip-e2e`      | Skips E2E wiring suite                                                   |
| `--output <path>` | Custom evidence JSON path                                                |

### Optional environment probes

| Variable                  | Gate                            |
| ------------------------- | ------------------------------- |
| `RELEASE_HEALTH_BASE_URL` | Staging `pnpm release:health`   |
| `RESTORED_ENV_BASE_URL`   | Post-restore validation harness |

## Static contract gates

| Script                             | Check                                   |
| ---------------------------------- | --------------------------------------- |
| `pnpm ci:route-metadata`           | Every API route exports metadata        |
| `pnpm ci:zod-boundaries`           | Zod at HTTP boundaries                  |
| `pnpm ci:permission-metadata`      | Protected routes declare permission     |
| `pnpm ci:entitlement-metadata`     | Tenant routes declare entitlement field |
| `pnpm ci:prisma-boundary`          | Prisma only in `@atlas/db`              |
| `pnpm ci:audit-metadata`           | Sensitive routes require audit          |
| `pnpm ci:outbox-metadata`          | Side-effect routes require outbox       |
| `pnpm ci:tenant-resource-registry` | IDOR registry completeness              |
| `pnpm ci:forbidden-scope`          | No Phase 2–4 product scope              |
| `pnpm security:check`              | Secrets, deps, security tests           |

## Restore validation (manual prerequisite)

1. Perform **manual isolated non-production restore** per ops runbook.
2. Set `RESTORED_ENV_BASE_URL` to the restored base URL.
3. Run:

```bash
pnpm release:restore:validate
```

Verifies health, tenant config manifests, and tenant isolation tests against the restored environment.

## Rollback verification

```bash
pnpm release:rollback:verify
```

Confirms rollback runbook presence and immutable `RELEASE_SHA` / `RELEASE_VERSION` target. Use `--strict-production` to require `RELEASE_OWNER` and `INCIDENT_OWNER`.

**Does not** perform automatic production rollback.

## Manual gates (never auto-passed)

See [manual-gates-checklist.md](../release/manual-gates-checklist.md).

## Security exceptions

See [security-exception-register.md](../release/security-exception-register.md).

## Verdict meanings

| Verdict                       | Meaning                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| `NOT_READY`                   | P0 automated failure or unresolved launch-critical P1                     |
| `READY_FOR_STAGING`           | Automated gates green; manual gates still required                        |
| `READY_FOR_PRODUCTION_REVIEW` | Staging health green + automated gates green; CTO approval still required |

`RELEASE_APPROVED` is **never** emitted by automation.
