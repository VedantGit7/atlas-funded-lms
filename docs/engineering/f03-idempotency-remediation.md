# F03: authorize and bind every idempotent replay

The user approved the F03 remediation in the comprehensive audit. Preserve F01 session MFA and F02 database-only platform authority.

## Design

For tenant routes, authenticate and resolve active membership as today, then run entitlement, current resource authorization, and session MFA before touching the replay registry. Separate usage charging from these read-time checks: charge only inside the claimed operation alongside the handler's writes.

Keep the existing unique `(tenant_id, idempotency_key)` claim to preserve compatibility with downstream business tables. Verify membership, operation scope, and request fingerprint on a conflict; a collision from another actor or operation is rejected, never executed as a fresh request. Missing legacy actor information fails closed. This avoids changing the key namespace and accidentally repeating existing operations during rollout.

Bound keys to 256 UTF-8 bytes. Expired, incomplete, oversized-response, or disappearing claims must not replay or execute without owning a claim. Retain the existing 24-hour deduplication window and purge only completed expired records. A key purged after that window can execute again; clients must reconcile uncertain outcomes before starting another operation.

All platform routes declaring required idempotency use a separate transactional registry. Keys bind to the original platform principal, method/path, and parsed query/params/body. Current permission, reason, and MFA checks precede replay. Provisioning's legacy key and slug fallbacks now return conflicts because they cannot prove request identity. Migration 107 and the grants bootstrap keep platform response data inaccessible to tenant and worker roles.

## Execution plan

- [x] Add failing behavioral tests for cross-member replay, operation collisions, legacy actor-less rows, expiration, missing claims, and key limits in `tests/unit/api/idempotency-security.test.ts`.
- [x] Add full tenant-wrapper retry tests for changed permissions, resource access, entitlement, membership, and MFA; verify authorized retries do not repeat handlers or usage charges.
- [x] Harden `backend/packages/api/src/idempotency-registry.ts` and split authorization from charging in `backend/packages/api/src/create-tenant-route.ts`. Preserve exported pipeline behavior for existing callers.
- [x] Review platform mutation deduplication and implement any required replay safeguards.
- [x] Update database-backed registry tests to supply actor identity and cover real transactional behavior using an isolated test target, without invoking the project's broad cleanup against development data.
- [x] Run targeted tests, offline regression, TypeScript, changed-file lint/format, relevant repository guards, and independent review. Record source hashes and rollout limitations.

## Verification and outcome

Implemented in the working tree on top of audited commit `ca8c0f1e7e69780b4e2ddc2a1136907a2e47c350`. F01/F02 protections and the operator's local grant were preserved. Migration 107 was applied to the local development database only; the platform console still opens in the existing browser session.

| Check                                                                              | Result                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before-fix regressions                                                             | 15 tenant/registry failures, four platform-wrapper failures, and two legacy-provisioning failures reproduced                                                     |
| Broader offline suite                                                              | 2,288 passed, one skipped across 311 files                                                                                                                       |
| Final targeted suite, including additional platform cases and updated API fixtures | 282 passed across 42 files                                                                                                                                       |
| Real Postgres verification                                                         | Seven tests passed in an isolated schema, including concurrent claims, rollback, actor binding, tenant separation, expiration, and platform privilege/RLS checks |
| TypeScript                                                                         | Passed                                                                                                                                                           |
| Changed-code lint                                                                  | 17 files passed with zero warnings                                                                                                                               |
| Repository guards                                                                  | Route metadata, Prisma boundary, secrets, audit compliance, and strict frontend API closure passed                                                               |
| Independent review                                                                 | No additional production defects; identified API mock regressions were corrected and the affected suites passed                                                  |
| Local database                                                                     | Migration applied; platform table forces RLS; tenant and worker SELECT denied; scratch schema removed                                                            |
| Local browser                                                                      | Existing operator session loads the platform console and normal operational-reason prompt                                                                        |

Source hashes and command evidence are recorded in [F03 verification](audits/2026-09-19/f03-verification.json). Earlier failed test logs are reproduction/debug evidence; the final targeted log records the corrected result.

## Rollout limits

No production migration or deployment, full production build, or live business mutation was performed. Real SQL tests cover the registry in isolation; route authorization tests use controlled service doubles. Output after resource deletion can be denied because authorization is recomputed from current state. External provider effects still require provider-level idempotency/outbox handling.

Platform retention scheduling is an explicit production rollout prerequisite, not installed by this patch. The tenant worker retains its existing active-tenant scope. See the [retry and retention runbook](../runbooks/idempotent-retries.md) for compatibility, cleanup, and deployment requirements.
