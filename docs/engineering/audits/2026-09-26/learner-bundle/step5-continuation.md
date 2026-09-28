# Step 5 learner bundle continuation — 26 September 2026

Raw `.log` files referenced below are retained locally and excluded from Git. Published JSON artifacts and this summary provide the repository evidence.

The final corrected production build reduces the maximum learner initial JavaScript from the previously accepted **290.57421875 KiB to 225.3955078125 KiB gzip**, a further **22.4%** reduction. Compared with the original rounded 403.8 KiB measurement, the reduction is approximately **44.2%**. **H16 remains open:** the maximum is **75.3955078125 KiB above the unchanged 150 KiB target**.

The production build, including TypeScript, exited successfully. Build ID: `7QSNVkqkqn62AigDUl1FG`. Measurements were taken at `2026-09-26T16:55:34.792Z`. The existing guard measured all **71 routes**, passed, lowered the ratchet to the exact final maximum, and passed again. No route exclusions, size accounting, target, or guard allowance were relaxed. The prior build's provisional 225.39453125 KiB result was not accepted as the baseline; the final corrected source is the evidence here.

## Final measurements

| Route | Initial gzip KiB |
| --- | ---: |
| Community and community space | 225.3955078125 |
| Learner home | 223.08984375 |
| Notification preferences | 212.0224609375 |
| Assessment attempt | 194.5869140625 |
| Public diagnostic result | 194.4423828125 |
| Login | 191.6806640625 |
| Signup | 189.75 |
| Password reset | 188.55078125 |

[All 71 routes and their initial chunks](step5-final-measurements.json) include exact sizes, shared-chunk flags, exported identifiers for inspection, build identity and SHA-256 hashes for the 67 owned source/configuration/test files. Chunk package markers are diagnostic heuristics, not package-level attribution. Measurements sum unique initial root and route manifest chunks, compressed separately with gzip and divided by 1024. They are local build evidence; they do not establish browser transfer totals, mobile field metrics, deployed latency, concurrency, or endurance acceptance.

## Implemented reductions

- Split notification category labels, groups and default/merge helpers into a browser-safe data module. Existing catalog validation exports remain compatible and retain Zod validation. The generated contracts mirror is checked by the sync tool.
- Split assessment answer serialization and preview helpers into a browser-safe utility. Existing validation schemas and compatibility exports remain in the original contract. Round-trip tests cover all ten answer types.
- Replaced simple score count-up, progress and viewport entrance animations with native browser animation APIs. Content remains rendered; reduced-motion preferences, viewport thresholds, cancellation and final values are covered. Remaining Motion components use the smaller `LazyMotion`/`domAnimation` boundary with the same DOM structure, refs, ARIA and presence behavior. The retained Motion chunk is approximately 25.2 KiB, down from roughly 46 KiB.
- Scoped React Query to the admin, studio and moderation layouts containing its active consumers. Global theme, currency and toast providers remain present. Account shell selection imports the authorized role's server shell; role/theme tests cover all four cases. Next still includes multiple shell components in some manifests, so this is not evidence of complete browser isolation by role.
- Replaced broad design-system imports in shared UI and shells with direct component/helper paths.
- Auth forms load their original schemas and Zod resolver at the first validation event. The complete initial form remains visible and usable. A failed chunk blocks submission, renders an error on an existing visible field and allows retry. Loading submission state disables the buttons, and a synchronous lock prevents repeated submissions while validation loads. Server schemas and validation remain unchanged.

Independent review found two auth edge cases that were corrected before the final build: duplicate submissions during cold schema loading, and a password-recovery render loop caused by returning a fresh form object. The final hook preserves React Hook Form's stable methods object. The actual password-reset form regression mounts with a valid recovery hash, checks that rendering settles and that recovery tokens remain registered. Its pre-fix render-loop failure is retained in the red test log (local log: `step5-recovery-red.log`).

Final independent read-only review found no blocking issues in the corrected hook and recovery regression. It confirmed stable form identity and live state, preservation of the original submit handler, and synchronous duplicate-submit locking with release in `finally`. Test and production-build results are the executed checks listed below, not an independent reviewer rerun.

## Verification

- **72 tests passed across 19 frontend files**, covering the new boundaries and animation/form regressions plus existing affected frontend checks: frontend test log (local log: `step5-frontend-tests.log`).
- **18 existing auth structure/schema tests passed across three files**: auth test log (local log: `step5-auth-tests.log`). The old structural assertion now accepts either eager or lazy Zod form integration while retaining the original contracts requirement; behavioral validation and failure tests verify the lazy implementation separately.
- **25 contract-sync and bundle-guard tests passed**: guard and contract test log (local log: `step5-guard-contract-tests.log`).
- Generated contract verification passed: **124 generated contracts, seven preserved handwritten utilities**: contract check (local log: `step5-contracts-check.log`).
- Owned-file ESLint passed with zero warnings: lint log (local log: `step5-lint.log`), additional auth test lint (local log: `step5-auth-lint.log`). Empty logs indicate successful quiet checks.
- Final Next production build and TypeScript passed: build log (local log: `step5-production-build.log`). The existing Sentry configuration deprecation warning remains.
- Baseline decreased to **225.3955078125 KiB**: baseline update (local log: `step5-baseline-update.log`); the final guard passed and explicitly reports H16 open: guard log (local log: `step5-final-guard.log`).

## Remaining target and reproduction

The shared framework root remains **129.20703125 KiB**, leaving only **20.79296875 KiB** for every other initial dependency under the 150 KiB target. Current shared providers/client helpers and shell components together already exceed that remaining allowance. Additional shell/provider architecture work and real browser measurements are required. Immediately required UI was not hidden or postponed to improve the manifest measurement. No further reduction is claimed by this continuation.

From the repository root, run `node scripts/perf/local-web.mjs build`, then set `ATLAS_PERF_BUILD=1` and run `node scripts/ci/check-learner-bundle-boundary.mjs`. Use only a completed production build. The baseline updater refuses increases. Clear database/Redis/test-cleanup environment variables before focused unit tests. The new regression files are `account-shell-selection`, `animation-boundary`, `answer-ui-boundary`, `lazy-form-submission`, `lazy-form-validation`, `native-animation`, `notification-catalog-boundary`, `password-recovery-lazy-form`, and `provider-boundary`, all under `tests/unit/frontend` with the `.test.ts` suffix. Contract/guard checks use `node --test scripts/sync-contracts.test.mjs tests/performance/learner-bundle.test.mjs`.

The earlier report and logs remain intact. This continuation was not committed or pushed, and does not close the separate capacity or endurance requirements.
