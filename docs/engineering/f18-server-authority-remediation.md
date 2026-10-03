# F18 — One authoritative server implementation

Implemented and verified locally on 20 September 2026. No deployment or hosted database change was performed.

## Ownership and request flow

| Area                                      | Authoritative owner                                    | Web responsibility                                                                                 |
| ----------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Business HTTP operations                  | `backend/apps/api/src/app/api/v1`                      | Browser requests pass through web `proxy.ts` and the existing before-files rewrite.                |
| Business services and repositories        | Backend API `src/server` and backend domain packages   | Server-rendered pages use HTTP adapters; they do not import backend application services.          |
| Workers and event dispatch                | Backend worker and event/domain packages               | No worker or event-dispatch implementation in the web app.                                         |
| Validation schemas, DTOs and shared types | Backend definitions, generated into `@atlas/contracts` | Import browser-safe generated contracts. Six inventoried frontend utilities remain handwritten.    |
| Auth callbacks, cookies and rendering     | Web `app/auth`, HTTP adapters and shell helpers        | Keep web-specific session/cookie forwarding, redirects, tenant gates and presentation projections. |

The web proxy continues to replace untrusted tenant/proxy headers, authenticate internal forwarding, preserve session cookies, and leave upload bytes untouched. The backend remains responsible for request validation, authorization, entitlements, tenant transactions, rate limits, audit and persistence. The privileged server API and public-auth HTTP adapters now carry `server-only` markers, enforced by the production build.

## Consolidation

Retired **617 web source files** after tracing actual consumers and checking backend counterparts:

- 200 server modules.
- 405 files in the shadowed API tree, including 206 route handlers and their supporting metadata.
- Three event/worker-dispatch files.
- Six diagnostic business modules and two duplicated diagnostic schema/type files.
- One unused public-auth orchestrator.

Only four live page/component imports reached the retired server tree; all were type-only. Those now use the shared contracts package. Diagnostic consumers also use canonical contracts. Live HTTP adapters previously imported through the misleading `@atlas/contracts-modules` alias now use the normal web `@/modules` alias. The obsolete alias and web application-to-backend-server alias were removed; the backend's own server alias remains valid.

A local ignored backup of the retired source is retained under `.test-results/f18/retired` because the workspace contains earlier uncommitted remediation work. Backend implementations, existing security fixes and web auth bridges were preserved.

Two web-only endpoints were hidden by the existing rewrite and lacked backend handlers. They now delegate to the existing backend services:

- `/api/v1/certificate-brand-kits`: GET, POST, PUT and DELETE with the canonical permissions, entitlements, validation, rate limiting and mutation metadata.
- `/api/v1/public/credentials/[credentialId]/download`: canonical credential validation, tenant lookup, entitlement enforcement, HTML/PDF bytes and attachment headers. Responses use `private, no-store`, including errors. The existing documented policy allowing historical revoked/expired/suspended certificate downloads remains unchanged.

The canonical lesson blob upload handler already existed and was retained. The obsolete web forwarding handler was removed; a regression test now exercises the real proxy's binary request and session/header behavior.

## Preventing recurrence

`pnpm check:server-authority` scans both applications and all **27 shared packages**, including nested domain workspaces. It rejects retired business trees, application-to-application imports and packages that import/re-export application code. It recognizes aliases, relative paths, re-exports, dynamic imports, CommonJS imports and import types. Regression fixtures cover direct and indirect coupling, nested packages, missing source roots and allowed web auth/adapters. This is an architectural dependency guard, not a semantic detector of every possible copied algorithm.

`pnpm sync:contracts` now produces deterministic, formatted contracts. `pnpm check:contracts` performs a nonmutating comparison and fails for missing, changed or orphaned files, missing source trees, and unsafe/unresolved dependencies. Only Zod and validated files inside the contracts package are allowed dependencies. Handwritten files are explicitly inventoried, and symlink/nonliteral dependency cases are rejected. Checks run before lint in CI; architecture/generator regression tests run in the unit job and root test chain.

There are **123 generated contract files and six handwritten utilities**. Node hashing helpers were moved out of automation/notification DTOs into backend-only modules. Cost attribution constants were separated from its calculations so contracts do not copy that business implementation. Three stale admin DTOs were removed after consumers moved to the current canonical contracts. Missing cost, entitlement and marketing contract definitions were synchronized.

The strict API closure check passes. Its three newly exposed runtime-link cases are documented precisely: server-issued Apple wallet and public credential download URLs, and the browser's CSP report endpoint configured outside web `src`. No blanket route exemption was added. The checker currently scans 807 backend route handlers; that number is not a count of independent product capabilities.

## Verification

| Check                                                   | Result                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture and contract-generator regressions         | 32 passed, including explicit failing cases before implementation/fixes.                                                                                                 |
| Repository authority and nonmutating contract checks    | Passed; 1,733 web files, 1,625 backend files and 27 shared packages covered.                                                                                             |
| Broad unit, structure, security, API and CI test run    | 3,135 passed, one optional PDF-worker test skipped; two process/cache permission failures passed on rerun (four tests across those two files).                           |
| Final affected automation/notification/structure checks | 510 passed, the same optional PDF-worker test skipped. Additional scoped extraction checks passed 35 tests. Counts overlap and should not be summed.                     |
| TypeScript project build                                | Passed.                                                                                                                                                                  |
| Fresh optimized web build                               | Passed using isolated fixture configuration and `.next-perf`, preserving the user's normal dev output.                                                                   |
| Route metadata and strict API closure                   | Passed.                                                                                                                                                                  |
| Focused lint and formatting                             | Passed.                                                                                                                                                                  |
| Authenticated browser journeys                          | Four passed: enrollment/resume/completion, assessment autosave/reload/grade, role grant/revoke, foreign read/update/delete/download denial with unchanged foreign state. |
| Preserved endpoint browser tests                        | Two passed: anonymous brand-kit denial/admin access; public credential download bytes/attachment/no-store and foreign-tenant denial.                                     |
| Learner bundle boundary/ratchet                         | Passed: worst route 403.8 kB gzip, home 353.6 kB. The separate 150 kB target remains open under F17.                                                                     |

Browser verification used disposable local PostgreSQL/Auth fixtures and restricted application database roles. It did not run against the hosted environment. This was six selected browser checks, not a rerun of every visual/accessibility journey or the full database-integration matrix. The broad test run exposed stale F16/F17 structural expectations; those were updated to assert actual tenant seeding, required credentials and committed Linux visual comparisons, and performance-tooling tests were added to the root test chain.

Independent review found two gaps in the initial guard's shared-package coverage. Both were reproduced with failing fixtures, fixed and independently rechecked. No review findings remain. Temporary verification services were stopped after validation; their disposable data and local evidence logs were retained.

**F18 status:** local implementation and acceptance checks complete. These changes remain in the working tree for the normal review and release process.
