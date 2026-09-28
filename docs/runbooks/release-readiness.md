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

> **Stale evidence:** A committed `release-evidence.json` in the repo root may lag the current branch (e.g. older `READY_FOR_STAGING` run). Never promote on that file alone — regenerate with `pnpm release:suite` and do not invent a `READY_FOR_PRODUCTION_REVIEW` verdict without a green suite + staging health.

### Local flags

| Flag              | Effect                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| `--skip-db`       | Skips DB-backed integration, tenant isolation, RLS, migrate, seed checks |
| `--skip-build`    | Skips production build                                                   |
| `--skip-e2e`      | Skips E2E wiring suite                                                   |
| `--output <path>` | Custom evidence JSON path                                                |

### Optional environment probes

| Variable                          | Gate                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| `RELEASE_HEALTH_BASE_URL`         | Staging application health origin                                    |
| `RELEASE_HEALTH_EXPECTED_RELEASE` | Required expected identity for the staging health probe              |
| `RESTORED_ENV_BASE_URL`           | Restored application's health origin                                 |
| `RESTORED_ENV_EXPECTED_RELEASE`   | Required expected identity for the restored application health probe |

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
2. Set `RESTORED_ENV_BASE_URL` to the restored base URL and `RESTORED_ENV_EXPECTED_RELEASE` to its expected release identity.
3. Run:

```bash
pnpm release:restore:validate
```

Checks application health and the expected release identity only. The result reports `evidenceScope: application-health-only` and `restoreProven: false`. It does not run tenant configuration or isolation tests, prove restored data or backup integrity, or measure RPO/RTO. Retain separate isolated database restore evidence for the manual restore gate.

## Rollback verification

```bash
pnpm release:rollback:verify
```

Checks runbook presence and an explicit target identity from `ROLLBACK_TARGET_RELEASE` (or legacy `RELEASE_SHA` / `RELEASE_VERSION`). This is preflight evidence only and does not prove artifact immutability. Use `--strict-production` to require `RELEASE_OWNER` and `INCIDENT_OWNER`.

After an authorized rollback, set `RELEASE_HEALTH_BASE_URL` and a distinct `RELEASE_CANDIDATE_RELEASE`, then add `--verify-health` to observe the target release. The result remains `rollbackProven: false`; retain deployment history and before/after evidence separately. See [the rollback runbook](rollback.md).

**Does not** perform automatic production rollback.

## Manual gates (never auto-passed)

See [manual-gates-checklist.md](../release/manual-gates-checklist.md).

**Latest capacity evidence, 26 September 2026:** [Performance verification](../engineering/performance-targets-2026-09-26.md) did not meet acceptance. The local two-hour clock completed, but only 98/100 learners completed endurance, 194/200 completed burst, latency/error gates failed and the development API restarted four times. Usage persistence also failed under load. Learner JavaScript improved from 403.8 to 290.6 KiB gzip; 150 KiB remains open. These observations neither prove hosted production capacity nor close the performance gate.

## Security exceptions

See [security-exception-register.md](../release/security-exception-register.md).

## Verdict meanings

| Verdict                       | Meaning                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| `NOT_READY`                   | P0 automated failure or unresolved launch-critical P1                     |
| `READY_FOR_STAGING`           | Automated gates green; manual gates still required                        |
| `READY_FOR_PRODUCTION_REVIEW` | Staging health green + automated gates green; CTO approval still required |

`RELEASE_APPROVED` is **never** emitted by automation.
