# F02: authoritative platform revocation

The user approved F02 from the 19 September audit. F01 changes already in the working tree are preserved.

## Design and scope

Platform permissions come only from an active `platform_operators` database grant. Remove the environment fallback completely rather than trying to distinguish missing and revoked grants in deployment configuration. Database failures must deny access. A deliberate new database grant can restore access; a revoked row is never silently reactivated.

Remove automatic tenant-admin provisioning from requests and sign-in, including the exported helper. A platform role is not a tenant role. Tenant permissions require explicit tenant membership and role assignment; suspended/removed memberships and removed roles must stay that way. Normal self-service learner enrollment remains governed by its existing separate policy.

Existing explicit tenant permissions are independent of platform grants. Older automatic provisioning did not record reliable per-membership provenance, so existing admin grants cannot safely be bulk-deleted by guessing. Include a legacy-access inventory and review in the rollout runbook. No live account or membership changes are performed by this code task.

Bootstrap/recovery uses controlled database administration with a recorded reason and retained grant history. There is no request-time emergency bypass. Update browser fixture seeding to create database grants explicitly and refuse to restore revoked fixture grants.

## Implementation plan

- [x] Add behavioral regressions for stale environment settings, grant revocation/downgrade, database failure, and tenant suspension/removal/role revocation.
- [x] Observe those tests fail on the existing implementation.
- [x] Remove environment authorization and all automatic elevation call sites; preserve current-session MFA.
- [x] Update fixture seeding, environment guidance, exception records, and controlled recovery instructions.
- [x] Run targeted and offline regression tests, TypeScript, changed-file lint/formatting and relevant repository guards.
- [x] Obtain independent review and record verification with final source hashes.

## Implementation outcome

Implemented locally on top of audited commit `ca8c0f1e7e69780b4e2ddc2a1136907a2e47c350`, preserving the preceding F01 session-assurance changes. Platform permission resolution now requires an active database grant and propagates database errors. The automatic tenant-admin helper and its nine call sites were removed. Browser fixture seeding explicitly creates a database grant only when there is no grant history and refuses to overwrite revoked or downgraded access.

No deployment, live grant changes, or legacy membership cleanup was performed. Before rollout, use the [platform operator access runbook](../runbooks/platform-operator-access.md) to establish approved database grants and review legacy tenant-admin access. Explicit tenant grants remain independent of platform access; revoking a platform grant does not revoke separately approved tenant membership.

There is no application emergency-access bypass. Controlled database recovery creates a new ordinary grant, preserves revoked history, and remains subject to F01 session MFA. A recovery grant's removal deadline is an operational requirement: the current schema does not enforce automatic expiry.

## Verification

| Check                                         | Result                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Regression reproduction before implementation | Six authorization failures and three fixture-seeding failures reproduced                           |
| Targeted auth, API, and membership tests      | 171 passed across 29 files                                                                         |
| Offline regression suite                      | 2,259 passed, one skipped across 308 files                                                         |
| Public login regression tests                 | Seven passed                                                                                       |
| TypeScript project build check                | Passed                                                                                             |
| Changed-code lint                             | 17 files passed, zero warnings                                                                     |
| Changed-code and documentation formatting     | Passed                                                                                             |
| Repository guards                             | Route metadata, Prisma boundary, secrets, audit compliance, and strict frontend API closure passed |
| Independent review                            | No actionable introduced defects found                                                             |

Verification includes behavioral checks that stale environment assignments cannot restore missing, revoked, or downgraded database authority; database errors deny access; tenant suspensions, removals, and role revocations remain effective; and separately approved tenant-admin access still works. Source searches found no runtime environment authorization or automatic elevation calls in application code or scripts.

The tests use controlled doubles for external services. No live database bootstrap, grant/revoke sequence, concurrent fixture execution, or production browser journey was exercised. Database locking was inspected and tested through the fixture double; its concurrency behavior was not exercised against a real database. A full production build was not run. Other audit findings, including F03 replay authorization, remain separate work.

Raw logs and source hashes are recorded in [the F02 verification record](audits/2026-09-19/f02-verification.json).
