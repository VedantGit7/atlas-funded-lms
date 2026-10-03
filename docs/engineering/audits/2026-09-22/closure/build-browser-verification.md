# Production builds and isolated browser verification

Verified on 22 September 2026 against the existing uncommitted F01–F22 work.

## Results

| Check | Fresh result | Evidence |
| --- | --- | --- |
| Web production build | Passed, exit 0 | `web-build-network-retry.log` |
| API production build after both fixes | Passed, exit 0 | `api-build-final.log` |
| Complete Linux Chromium suite | 25 passed; zero failed, skipped or flaky; 280.6 seconds | `browser-final.json`, `browser-final.log` |
| Linux visual comparisons | All four passed; snapshot updates disabled | Included in the complete browser result |
| Lesson progress integration, tenant isolation and unit guards | 25 tests passed across three files | `lesson-progress-final.log` |
| Local filesystem storage behavior | Four tests passed | `local-storage-regression.log` |
| Changed-source lint and formatting | Passed | `verification-fixes-lint-final.log`, `verification-fixes-format.log` |
| Standalone artifact inspection | No environment files, fixture credentials, raw verification logs or raw application-source copies found in the inspected application output | `build-browser-manifest.json` |

The browser inventory is now 25 checks rather than the historical F16 report's 23: it includes two F18 canonical API-routing checks. It uses genuine local Supabase authentication, administrator TOTP, restricted runtime database logins, separate tenant sessions and database persistence assertions. The servers ran in development mode on 3100/3101; Chromium ran in the dedicated Playwright 1.61.0 Ubuntu 24.04 container. There were no retries or snapshot updates.

## Failures retained and changes verified

1. The first web build could not download Google Fonts under the restricted network. The same supported local production-build harness passed with network access. `web-build.log` retains the failure; deployment configuration checks were not weakened.
2. The initial API build succeeded but traced 1,628 unrelated raw API source files through the configurable development filesystem-storage root. A Turbopack tracing annotation now identifies that path as runtime object data. The report-download trace fell from 2,396 entries to 761, with zero raw application-source entries. Runtime filesystem storage behavior is unchanged. `api-tracing-red.json`, `api-tracing-green.json` and the final artifact manifest preserve the result.
3. An overlapping learner autosave returned a duplicate-key error during the first browser run. Two real PostgreSQL regressions reproduced both a rejected concurrent first completion and a late autosave downgrading completed progress. The service now locks the tenant/member enrollment before reading progress. This serializes first insertion, progress calculation, course completion and completion-event publication. Both regressions passed, along with the existing progress and tenant-isolation checks. The tests observe actual PostgreSQL lock waits rather than depending on arbitrary sleep timing. `lesson-progress-red.log` retains the failures.
4. The first complete browser run passed 24 of 25 checks. J11 failed its successful same-tenant certificate-download control because the local web proxy received `ECONNRESET` and returned 500. The unchanged J11 assertions passed on a direct rerun. A fresh scenario seed and full rerun then passed all 25 checks against the progress fix. The initial failure remains in `browser-full.json` and `browser-full.log`; the focused rerun is in `browser-j11-recheck.json`.

## Limits and cleanup

These builds use the existing sanitized local build harness with `NODE_ENV=production` and `APP_ENV=test`. They establish production compilation, type checking and standalone packaging, not configured production startup or real-host acceptance. No deployment, hosted Supabase/customer-account operation, production database change, commit or push was performed. Build IDs and source hashes are recorded in `build-browser-manifest.json`.

The seven historical F16 injected-failure probes were not completed in this closure run. An optional probe run was started and then interrupted when the remaining verification scope was narrowed; it is not counted as passing evidence. Historical probe evidence remains described in the F16 remediation report.

The development-server logs also show an existing administrator dashboard hydration mismatch: default-locale month formatting renders `Sept` on the Windows server and `Sep` in Linux Chromium. This is retained as a UI follow-up; the successful functional/visual checks are not a claim of a console-error-free application. J01, J04, J05 and J08 remain explicitly limited shell-smoke coverage. This work does not establish production performance, full feature coverage, live storage/email integration or staging/production readiness.

The verification API/web process trees, isolated authentication/database/gateway containers and Linux browser container were stopped. Ports 3100/3101 have no listeners. Generated `next-env.d.ts` imports were restored to the normal `.next/dev` paths. Regression fixtures in the separate closure database were cleaned by the F20 ownership guard. Raw browser traces and mutable credentials remain in ignored `.test-results` paths; checked-in evidence contains sanitized summaries/logs.
