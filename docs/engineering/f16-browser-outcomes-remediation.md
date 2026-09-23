# F16 — Browser outcomes and tenant denial

Date: 2026-09-20. Scope: the first critical browser suite specified in the audit.

## What changed

The critical journeys now perform actions and check persisted outcomes, instead of treating a visible page shell as success.

| Journey | Outcome checked                                                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J02     | Enroll through the UI, navigate the course outline, save and resume lesson progress, complete with the keyboard, reload and read saved lesson/course progress.                                             |
| J03     | Start an assessment, autosave Paris, reload the selected answer, submit with the keyboard and confirmation dialog, verify the saved graded result and score.                                               |
| J06     | Create a course and chapter, request review, approve in a separate administrator session, verify publication and visibility in a separate learner session.                                                 |
| J07     | Return an independently submitted course to draft and verify the saved review note.                                                                                                                        |
| J09     | Grant and revoke an instructor role, verify saved assignments and effective permission changes in an already-open target session.                                                                          |
| J10     | Provision a tenant with a reason, verify its active state, domain, invited owner, system role permissions and audit records; change an entitlement and verify it after reload.                             |
| J11     | Reject another tenant's course read/update/delete and certificate download; check exact denial responses, absence of private data, successful same-tenant controls and unchanged foreign database records. |

J01, J04, J05 and J08 are explicitly named **shell smoke** coverage. They do not claim completed signup, swipe, readiness conversion or moderation decisions. Those broader journeys remain follow-up work outside this first critical suite.

The new tests exposed and fixed course-outline navigation: enrolled learners previously received ordinary lesson links only while a tag filter was active. Unfiltered lesson navigation now works, optional tags are encoded, and stale requests cannot overwrite a newer filter or enrollment state.

The complete suite also exposed nested main-content landmarks on the administrator moderation queue. The queue now uses the parent administrator layout's single main landmark.

## Real authentication and isolated state

- Fixtures refuse hosted authentication and databases outside local `atlas_lms_e2e` / `atlas_lms_ci` targets.
- Administrators and platform operators enroll and verify real Supabase TOTP factors. There is no MFA flag, token or authorization bypass.
- The application runs with restricted database login roles. A separate guarded, read-only owner connection verifies foreign records and provisioning results.
- Test credentials and mutable fixture manifests are stored under ignored `.test-results/` paths. Seed scripts never print credentials by default.
- A separate Docker database/auth stack and ports 3100/3101 keep local browser runs away from the development/customer database and hosted Supabase project.
- Fresh scenarios are required between complete runs. The dedicated role-test account is reset when scenarios are seeded, including after an intentional failed-revocation probe.

Fresh provisioning also uncovered an existing migration prerequisite: migration 039 grants to database roles that previously were created only after all migrations. The provisioning script now creates those group roles before migrations, while retaining the full post-migration grant/RLS phases.

## CI and visual checks

Linux Chromium baselines are captured using Playwright 1.61.0 on Ubuntu 24.04. CI rejects the visual-skip flag and missing baselines cannot be silently generated. Request IDs and developer-tool overlays are excluded from comparisons. Failures retain traces, screenshots and video; tests do not automatically retry against partially mutated fixtures.

The disposable browser job explicitly uses development servers. Its local HTTP auth/storage cannot satisfy the production deployment contract; production startup checks remain enforced in their separate checks. Browser results from this fixture are not production performance or staging evidence.

## Failure sensitivity

`verify-failure-probes.mjs` runs each critical journey with one controlled browser-response fault. A probe is accepted only if its interception actually ran and the expected outcome assertion failed; startup failures or an unexpectedly passing test fail the probe runner.

Each run uses fresh report paths, rejects runner-level errors and multiple/retried results, and replaces the summary with a pending status before work starts. A previous successful report cannot satisfy a failed startup. The fixture guard also rejects PostgreSQL connection-query overrides that could redirect an apparently local URL to a different host or database.

| Probe                   | Regression represented                                                |
| ----------------------- | --------------------------------------------------------------------- |
| completion-not-saved    | UI reports completion, database still contains incomplete progress    |
| wrong-grade             | Submission returns an incorrect grade                                 |
| review-skipped          | Authoring skips the required review state                             |
| review-return-not-saved | Requesting review changes reports success without returning the draft |
| role-not-revoked        | Revocation reports success without removing access                    |
| entitlement-not-saved   | Platform update reports success without saving the change             |
| foreign-read-allowed    | A foreign object is returned successfully with private content        |

## Running locally

From the repository root, use the dedicated disposable stack:

```powershell
docker compose -f scripts/e2e/local-stack.compose.yml up -d database
node scripts/e2e/setup-local.mjs
docker compose -f scripts/e2e/local-stack.compose.yml up -d auth gateway
# Wait until this health check succeeds before seeding users.
Invoke-RestMethod http://127.0.0.1:54326/auth/v1/health
node scripts/e2e/local-run.mjs seed
```

Run `node scripts/e2e/local-run.mjs api` and `node scripts/e2e/local-run.mjs web` in separate terminals. Then run `node scripts/e2e/local-run.mjs test --workers=1`. Before another complete run, run `node scripts/e2e/local-run.mjs scenarios`. Run `node scripts/e2e/local-run.mjs probes` for failure sensitivity. This runner uses a separate Next build directory and process-local hostname resolution, without editing the machine's hosts file.

For Linux screenshots from Windows, start the official `mcr.microsoft.com/playwright:v1.61.0-noble` browser server on local port 9323 and set `E2E_LINUX_BROWSER_WS=ws://127.0.0.1:9323/`. The remote connection exposes only local loopback addresses. Use `--update-snapshots=all` only for an intentional baseline update, then repeat with `--update-snapshots=none` and inspect the images.

```powershell
docker run -d --name atlas-f16-browser --init -p 127.0.0.1:9323:9323 mcr.microsoft.com/playwright:v1.61.0-noble npx --yes playwright@1.61.0 run-server --port 9323 --host 0.0.0.0
$env:E2E_LINUX_BROWSER_WS = 'ws://127.0.0.1:9323/'
node scripts/e2e/local-run.mjs test --workers=1 --update-snapshots=none
```

Run browser verification and failure probes sequentially; they share disposable account state and the application's real rate limits. Stop the test API/web terminals and use `docker compose -f scripts/e2e/local-stack.compose.yml stop` plus `docker stop atlas-f16-browser` when finished.

## Verification evidence

The focused unit and CI-contract run passed **39 tests across five files**: isolated fixture target rejection, TOTP reference vectors, platform-user seeding, course-outline links, and CI evidence requirements. The three new connection-query override cases were first observed failing before the guard was fixed.

The complete Linux browser run exercised **23 checks**: 22 passed and the moderation queue exposed the duplicate main landmark. After that fix and the test-timing corrections, the final affected-scope run passed **7/7** (J02, J06, J08 and four visual comparisons). All seven stateful critical journeys have passed against real isolated services. A subsequent screenshot-only comparison passed **4/4** with snapshot updates disabled. Logs are under `.test-results/f16-full-linux.log`, `.test-results/f16-final-verification.log` and `.test-results/f16-visual-verified.log`.

All **seven failure probes passed** in one sequential run on 20 September 2026 (12:58:07–13:01:51 UTC). Each injected fault was applied and rejected at the intended outcome assertion. Evidence is generated at `.test-results/f16-probes/evidence.json`; CI uploads this sanitized summary. Earlier unrelated timing and rate-limit failures were rejected by the runner and were not counted as passing probes.

Scoped ESLint, strict TypeScript checking of browser helpers/specifications/configuration, and changed-file whitespace checks passed. Screenshots were visually inspected as well as compared automatically.

No hosted CI run, staging/production verification, deployment, or hosted service changes were performed. The fixture suite uses development servers and local storage, so it does not establish production performance, external email delivery, object-storage integration, or coverage of every LMS feature. The four journeys explicitly named shell smoke remain limited to page reachability. Linux screenshots are platform-specific and should be reviewed if the CI image or fonts change.
