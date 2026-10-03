# F01: current-session MFA enforcement

The user approved implementation of F01 from the 19 September 2026 audit. This note records the implementation scope and verification plan.

## Design

Use Supabase's verified JWT claims for the exact access token authenticated by `getUser`. Expose `sessionAssuranceLevel` separately from `mfaEnabled`; the latter remains verified-factor enrollment information. Require `sessionAssuranceLevel === "aal2"` for platform operations and tenant routes declaring MFA. Missing or unknown assurance cannot satisfy that gate; failed token verification rejects authentication. Never derive assurance from user metadata, a database enrollment flag, or a different refresh-token session.

Use the installed SDK's `getClaims(accessToken)` so signature/expiry verification remains in the auth library. Retain `getUser(accessToken)` to validate the user with the auth service. Both cookie and bearer authentication use this same boundary. Remove the session mutation and extra factor-list lookup from this read path; verified factors are already available on the authenticated user.

Check MFA before returning an idempotent response as well as before executing a protected handler. This closes the MFA portion of F03; actor binding and general authorization on replay remain separate F03 work. No new challenge-freshness policy, schema changes, account grants, or hosting changes are included.

## Implementation and verification sequence

- [x] Add failing regression tests: enrolled AAL1 is denied, AAL2 is accepted, absent/invalid assurance is denied, and ordinary tenant operations remain available without MFA.
- [x] Add session-boundary tests for exact-token claims, invalid claims, cookie/bearer authentication, verified versus pending enrollment, and refreshed sessions.
- [x] Add behavioral platform and tenant-route tests, including cached response denial at AAL1.
- [x] Implement verified assurance resolution and propagate it through the platform and tenant gates.
- [x] Run targeted tests, offline regression suites, TypeScript and changed-file lint; preserve the shared development database by removing connection variables from offline test processes.
- [x] Review the diff and record verification results. Keep the historical audit evidence intact and link this remediation note from F01.

## Implementation outcome — 19 September 2026

Implemented in the local working tree based on `ca8c0f1e7e69780b4e2ddc2a1136907a2e47c350`; not committed or deployed as part of this task. The platform guard, shared tenant wrapper, protected-handler helper, and seven manual route call sites carry verified session assurance. Enrollment badges now say “MFA enrolled” rather than implying session verification.

| Verification                                                              | Result                                                                                                                                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red regression stage                                                      | New tests reproduced enrollment-based acceptance and cached-response bypass before implementation; see `f01-tests-red.log` and corrected-fixture `f01-routes-red.log` |
| Targeted auth/API/authorization tests, rerun after final code corrections | 23 files, 145 tests passed                                                                                                                                            |
| Broader offline unit/security/structural/event regression                 | 305 files, 2,246 tests passed, 1 skipped                                                                                                                              |
| TypeScript project check                                                  | Passed after explicitly mapping the SDK's extensible assurance strings to the application's closed set                                                                |
| Changed-file ESLint                                                       | Passed on all 18 changed/new TypeScript and TSX files, with zero warnings                                                                                             |
| Independent code review                                                   | No actionable introduced defects found; exact-token verification, replay gate and manual propagation reviewed                                                         |

Logs and the file manifest are in `audits/2026-09-19/f01-*`. Tests mock external auth/database services; they do not constitute a live Supabase login/challenge or deployed browser test. Signature/expiry verification is delegated to the installed Supabase SDK, whose implementation was inspected. A live staging MFA challenge and sensitive-action smoke test remain deployment acceptance checks.

The review also noted an existing refresh limitation: when the request already contains an expired access cookie, the refresh path can reread that stale request cookie instead of the updated cookie store. The absent-access-token refresh case is covered here. That pre-existing behavior is unchanged and should be addressed separately. F02 and the actor/permission/entitlement portions of F03 remain open.

## References

Final formatting checks passed on the 18 code files and this note. Route metadata, Prisma boundary, secret scanning, and strict frontend API closure checks also passed. The machine-readable `audits/2026-09-19/f01-verification.json` records final results and source hashes.

- [Supabase MFA assurance levels](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase verified claims API](https://supabase.com/docs/reference/javascript/auth-getclaims)
