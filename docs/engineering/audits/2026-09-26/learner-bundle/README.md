# Learner initial JavaScript reduction — 26 September 2026

**Latest evidence:** [Step 5 continuation](step5-continuation.md) lowers the verified maximum further to **225.3955078125 KiB**, with all 71 routes measured from the corrected final production build. The **150 KiB target remains open**. The report below preserves the earlier measurement and its evidence.

The isolated production builds use Next 16.3.5 and the sanitized `scripts/perf/local-web.mjs build` environment. The existing bundle guard measured 71 routes in the baseline and final builds. The heaviest route fell from **403.8 KiB to 290.57421875 KiB gzip**, about **28.0%**. The **150 KiB target remains open**, with 140.57421875 KiB still to remove from the maximum. This is local build evidence, not deployment, browser-transfer, latency, or concurrency evidence.

## Measured routes

| Route | Before | Analytics only | Final | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Public diagnostic result | 403.8 | 337.9 | 260.6 | 143.2 |
| Notification preferences | 356.5 | 290.6 | 290.6 | 65.9 |
| Learner home | 353.3 | 287.4 | 287.4 | 65.9 |
| Public diagnostic runner | 350.7 | 284.9 | 207.3 | 143.4 |
| Assessment attempt | 344.8 | 278.9 | 278.9 | 65.9 |

All numbers in this table are KiB (1024 bytes). The baseline and intermediate guard logs retained only the five largest routes, rounded to one decimal; reductions therefore have the same precision. `measurements.json` contains exact final bytes for all 71 routes, the five before/after comparisons, build ID and hashes of changed application files. These are the sum of each route's unique initial manifest chunks, not the largest individual chunk. The shared framework root remains 129.2 KiB.

## Changes and safety checks

- `frontend/apps/web/src/observability/posthog-browser.ts` now imports the optional analytics SDK only after a configured key and consent are present. Approved, sanitized events raised during loading are preserved. Revocation and logout invalidate pending events; a load finishing without current consent does not initialize the SDK. SDK loading/initialization failure stays best effort and can be retried. Existing no-autocapture, no-pageview, no-replay, in-memory persistence settings remain. The SDK defaults to denied and explicitly reconciles current consent after initialization without emitting `$opt_in`; unused feature-flag requests are disabled, including the SDK's automatic flag reload during reset.
- `frontend/apps/web/src/features/diagnostics/components/DeferredDiagnosticIdentityGate.tsx` waits for the first open before loading the signup/login dialog and validation dependencies. Once opened, it stays mounted when closed, retaining form values. Loading and failure states support Close and Escape. A rejected chunk is caught locally with Retry; it cannot replace the completed diagnostic or reset the parent runner's in-memory state. Cancelled loads are ignored when they settle.
- `AnonymousDiagnosticResultView.tsx` and `PublicDiagnosticRunner.tsx` use that wrapper. The actual identity form, validation schemas, login/signup/merge requests and authorization checks are unchanged.
- `configs/learner-bundle-baseline.json` is ratcheted down to the exact measured 290.57421875 KiB. The guard and 150 KiB target are unchanged, and the guard passed again after updating the ceiling.

The first analytics regression run failed on eager loading and pending consent/logout behavior, as recorded in `posthog-red.log`. A DOM test first failed because the identity form module loaded before opening; after the change it checks first-open loading, close/reopen and retained input. Independent review reproduced stored SDK denial and reset behavior against the installed SDK, and identified the need to contain optional chunk failure. Those regressions failed before correction (`review-red.log`). The final focused run passed 22 tests across the new analytics/dialog tests and existing logout/diagnostic/observability regressions, plus all eight bundle-guard tests. Targeted lint passed with zero warnings. Production TypeScript checking passed as part of each completed build. See `regression-tests.log`, `guard-tests.log`, `lint.log`, `production-build.log` and `final-guard.log`.

## Remaining cost and next focused work

`final-chunks.json` records actual initial chunk names, sizes and exported identifiers for the worst route, home and public result. Chunk sizes describe whole chunks, so they are not additive estimates of individual packages when code is shared.

1. **Notification catalog brings the Zod runtime into the browser: 63.27 KiB chunk.** `NotificationPreferencesForm` needs category labels/groups but imports `notification-preferences.catalog.ts`, which also imports Zod and constructs a category schema at module scope. Its initial chunk contains Zod constructors, schema-generation helpers and locales. A safe next step is separating plain catalog data/types from validation exports, retaining the existing server validation contract and testing every notification category/default. This does not require removing validation. After removing this cost, home would become the ceiling unless also improved.
2. **Account routes include multiple role shells.** The notification route has a 12.50 KiB chunk exporting `TenantAdminShellClient` and a 10.93 KiB chunk exporting `StudioShellClient`, `ModerationShellClient` and account UI. `AccountShell.tsx` statically imports each shell before choosing a role on the server. Investigate route/client boundaries with role-specific browser-transfer evidence and authorization regressions. The current source import guard alone does not detect this shared-layout cost.
3. **Animation code remains on home and scorecard routes.** The Motion chunk is roughly 46 KiB. Any reduction should preserve entrance animation, score count-up, viewport behavior and reduced-motion preferences. Avoid simply delaying immediately needed UI to make the manifest number look smaller; validate browser interaction and total transfer before accepting a replacement.
4. **Shared providers and design-system boundaries remain.** The notification route includes a 16.50 KiB provider/query/client-helper chunk and design-system chunks of 11.41 and 10.03 KiB. Audit unused client exports and provider placement before splitting; preserve query caching, currency, theme, toast and accessibility behavior.

The 129.2 KiB framework root leaves only about 20.8 KiB for all other initial JavaScript under the stated target. Reaching 150 KiB needs additional focused route architecture work and real browser measurements. This change does not claim that target, production capacity, or mobile field metrics are satisfied.

## Reproduction

From the repository root, run the isolated production wrapper with Node, then `scripts/ci/check-learner-bundle-boundary.mjs` with `ATLAS_PERF_BUILD=1`. Do not use an unfinished or stale `.next-perf` build. Run `--update-baseline` only after a successful real reduction; it refuses increases. Run the six regression files listed below, and `node --test tests/performance/learner-bundle.test.mjs`. Clear database/Redis test environment variables before the focused Vitest run so unrelated global teardown cannot touch an external database.

- `tests/unit/frontend/posthog-lazy.test.ts`
- `tests/unit/frontend/diagnostic-identity-lazy.test.ts`
- `tests/unit/frontend/diagnostic-identity-load-failure.test.ts`
- `tests/unit/frontend/perform-logout-lazy.test.ts`
- `tests/lint-rules/diagnostic.structure.test.ts`
- `tests/lint-rules/observability.structure.test.ts`

The final build exited successfully, observed at **2026-09-26 10:44:29 UTC**. All frontend build/lint/test processes had finished by that time. The local review corrections and final formatting added 24 compressed bytes to the unaccepted interim measurement; the accepted ratchet compares the final build with the historical checked-in 404.1962890625 KiB ceiling. No guard allowance above that historical ceiling, guard relaxation, or target change was introduced.
