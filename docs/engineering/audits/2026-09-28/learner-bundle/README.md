# Step 5 learner bundle continuation — 2026-09-28

Raw `.log` files referenced below are retained locally and excluded from Git. Published JSON artifacts and this summary provide the repository evidence.

The largest measured learner first load is **204.4345703125 KiB gzip**, down from **225.3955078125 KiB** on September 26: a **20.9609375 KiB / 9.30%** reduction. This is approximately **49.37% below the original rounded 403.8 KiB** measurement. **H16 remains OPEN:** the unchanged 150 KiB target is still exceeded by **54.4345703125 KiB**. Passing the ratchet does not close the target or Step 5.

The successful Next.js 16.3.5 Turbopack production build is `VOXnDdBcAq2FcpKw35Yn3`. All **71** routes accepted by the existing learner-route filter were measured. Shared root JavaScript is **129.1904296875 KiB**. Four of those routes are at or below 150 KiB. The ratchet in `configs/learner-bundle-baseline.json` was lowered to the exact new maximum; its target remains 150.

| Route | September 26 KiB | Final KiB |
| --- | ---: | ---: |
| `/` | 223.08984375 | 176.4169921875 |
| `/(learner)/community` | 225.3955078125 | 183.158203125 |
| `/(learner)/resources` | 219.388671875 | 178.517578125 |
| `/(learner)/certificates` | 220.2802734375 | 178.341796875 |
| `/(learner)/hall-of-fame` | 219.1611328125 | 204.4345703125 |
| `/(learner)/progress` | 218.9521484375 | 204.2275390625 |
| `/profile/security` | 224.31640625 | 198.56640625 |
| `/(auth)/login` | 191.6806640625 | 177.900390625 |

## Changes and preserved behavior

- Static landing sections and the dashboard now render through server component boundaries. Theme controls, navigation, FAQ interaction, CTA tracking, personalized content and live currency updates remain in the appropriate client components.
- Community comment/reply disclosures and mobile resource filters use a small native animation component. Tests cover initial visibility, StrictMode, enter/exit, stale completion after reopening, inert exiting content, measured collapse height and initial/live reduced-motion preferences.
- Tenant logos use native images because these URLs were already explicitly unoptimized. Their URLs, dimensions, alt text, lazy loading, asynchronous decoding, theme variants and forwarded image properties are preserved.
- Certificate sharing loads its existing dialog when sharing starts. Pending/failure UI provides close, escape, focus trapping/restoration and retry. The loaded dialog stays mounted through its existing exit animation. The initial certificate list remains available.
- MFA loads its existing QR renderer and SVG sanitizer before creating an enrollment. Failed code loading shows an error, unlocks retry and does not create a stranded factor. The sanitizer still removes unsafe SVG content.
- The public marketing runtime loads after hydration, matching its existing post-hydration rendering behavior. Existing learner-shell deferral uses the same boundary.
- Error fallback components load the Sentry reporter when an error occurs. They report the original exception; reporter/load failures produce a local diagnostic rather than a silent catch. Tests verify successful reporting, failure behavior and later retry. Existing SDK instrumentation configuration was not changed.

No learner access checks, authentication validation, required initial content, bundle accounting, route exclusions or build configuration were weakened to obtain these reductions. Deferred code remains available for the feature that needs it; this audit does not claim that all lifetime JavaScript transfers decreased by the initial-load delta.

## Verification and evidence

- Production build (local log: `production-build.log`): completed compilation, TypeScript and all 95 static-page generation entries, exit 0.
- Frontend regression tests (local log: `frontend-tests.log`): **76 tests across 27 files passed**, including the new boundary, loading/failure, accessibility and animation cases plus existing shell/theme/validation/password/certificate regressions.
- Guard tests (local log: `bundle-guard-tests.log`): **8 passed**, including missing/incomplete artifact rejection and exact baseline enforcement.
- ESLint (local log: `lint.log`): all **40 owned source/test files** passed with zero warnings; [file list](verification-files.json) and format log (local log: `format.log`).
- Baseline update (local log: `baseline-update.log`) and fresh unchanged guard (local log: `final-guard.log`): passed; the guard explicitly reports H16 OPEN.
- [Final full measurements](final-measurements.json): every route and initial chunk, chunk SHA-256, exact gzip sizes, measurement timestamp and SHA-256 of the 40 verified source/test files. Compact summary (local log: `measurements-summary.log`).
- [Prior full measurements](../../2026-09-26/learner-bundle/step5-final-measurements.json) and [intermediate source-reduction measurements](source-reduction-measurements.json) retain the comparison chain. Red-test logs in this directory retain the failures observed before the corresponding fixes.

`measure.mjs` is a companion evidence collector. The unchanged acceptance guard remains authoritative. Both use the union of `rootMainFiles` and a route manifest's `entryJSFiles`, deduplicate chunk names, gzip each file separately and divide bytes by 1024. Admin/studio/platform route exclusions are unchanged. These are production artifact measurements, **not browser transfer traces, a deferred-request accounting total, or a field latency result**.

The remaining largest routes include their shared application/provider dependencies and general Motion code. Shared root JavaScript alone consumes 129.19 KiB, leaving only 20.81 KiB of the requested budget for all additional initial route code. This explains the remaining challenge, but does not establish an irreducible framework floor or justify changing the target. Further source-boundary work would require another implementation and verification cycle. This continuation stops with the measured 204.43 KiB result; it does not declare the 150 KiB work complete.

All work and checks were local. No deployment, commit, push or paid infrastructure was performed by this bundle task.
