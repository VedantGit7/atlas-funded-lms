# F09 CI and release evidence remediation

## Authorized design and implementation plan

The user requested F09 from the comprehensive audit. Preserve the existing F01–F08 working tree. Repair workflow admission and dependency coverage, create one fail-closed aggregate check, publish fresh candidate-specific evidence, pin external actions/tool versions, and correct CODEOWNERS paths. Do not turn stale evidence green or weaken failing product tests. Local validation cannot stand in for a hosted candidate run.

Keep the existing named CI jobs and full release suite, then add an aggregate gate covering every mandatory job (including static security/event checks). This preserves visibility and avoids a broad workflow rewrite. Generate evidence from actual outcomes with the candidate SHA/run identity, upload it even on failed runs, and reject missing/skipped/failed mandatory checks. Optional environment health checks must be identified explicitly. Harden the existing release-suite evidence contract independently of the new aggregate evidence.

- [x] Inspect hosted workflow failures and reproduce schema/dependency/evidence defects locally.
- [x] Repair CI/drills syntax, pin actions/tooling, preserve automatic dependency updates, and update ownership paths.
- [x] Add tested fail-closed aggregate CI evidence generation and enforce complete workflow dependencies.
- [x] Harden release-suite evidence validation/generation with failing regression tests first.
- [x] Run workflow validation, positive/negative gate tests, appropriate repository checks and independent review.
- [x] Record exact local/hosted verification limits and rollout steps; never claim a hosted pass for uncommitted changes.

Implementation files: `.github/workflows/{ci,drills}.yml`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `scripts/ci/` aggregate contract/evidence tools and tests, plus `scripts/release/{run-suite,validate-evidence}.mjs` and focused release evidence tests. Changes remain reviewable in the current working tree; no deployment is necessary for this remediation.

## Status, 20 September 2026

Implemented and verified locally. **Hosted acceptance remains pending.** The checkout still contains the accumulated, uncommitted F01–F09 work; this remediation has not been pushed, deployed, or run on GitHub. The local HEAD is `ca8c0f1e7e69780b4e2ddc2a1136907a2e47c350`; that SHA alone does not identify these working-tree changes. Source hashes are recorded in the [local verification manifest](audits/2026-09-20/f09-verification.json).

The latest inspected remote CI run [35425980742](https://github.com/VedantGit7/atlas-funded-lms/actions/runs/35425980742) and drills run [35425980312](https://github.com/VedantGit7/atlas-funded-lms/actions/runs/35425980312) both failed with zero jobs, on remote commit `d684a56aacfbf5e93e92b4b4c671e3e2465fc062`. These predate the remediation. The connector did not expose the admission annotations and the browser was not signed into the private repository. No billing or other hosted cause is inferred from the zero-job result. See [hosted snapshot](audits/2026-09-20/f09-hosted-status.json).

## Implemented changes

### Workflow admission and complete gating

Actionlint reproduced the unsupported top-level `x-generate-prisma-client` key and invalid job-level `env.CI_DATABASE_URL` expressions. Removed the custom key and expanded Prisma generation into supported steps; supplied the disposable CI database URL in valid locations, including install steps whose postinstall generates the client. Both workflows now pass Actionlint 1.7.12. These are confirmed local schema defects; hosted execution is still needed to establish that every admission problem is resolved. References: [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [context availability](https://docs.github.com/en/actions/learn-github-actions/contexts#context-availability).

Added `ci-required`, an always-run aggregate that directly depends on every other CI job. Its checked-in contract contains 34 mandatory jobs and one explicitly optional environment health job. Missing, failed, cancelled, skipped mandatory jobs, unknown statuses, and unregistered jobs fail the aggregate. The build also waits for every mandatory verification job, including static/event structure, audit metadata, package exports, and outbox worker checks. Tests enforce agreement between the contract and workflow graph so a new job cannot silently escape the gate.

CI supports manual dispatch and merge queues. Jobs have bounded timeouts and use Ubuntu 24.04. External actions are pinned to full commit SHAs, Node to 22.13.1, pnpm to the package-manager version 11.6.0, and Supabase CLI to 2.117.0. Actionlint's download is versioned and checksum-verified. Dependabot maintains action and npm updates. CODEOWNERS paths now point to the current backend/frontend structure while retaining the existing owner.

The load drill now applies its tenant seed instead of only previewing it, and missing drill artifacts are errors. No scheduled drill was executed against a real environment during this task.

### Evidence tied to the actual candidate

The new CI aggregate artifact records the actual candidate SHA, repository, GitHub run ID/attempt, timestamp, each job outcome, and blockers. It rejects a dirty checkout, mismatched SHA, malformed results, or absent GitHub run identity. Successful aggregation means `CI_PASSED`; it never grants production approval.

Release-suite evidence uses schema version 2 with an exact contract of 29 automated and eight manual gates. Generation and validation establish actual Git HEAD and checkout cleanliness, reject stale evidence (24 hours by default), reject mismatched CI attempts, validate every gate, and derive readiness from outcomes. Required P1 failures and required skips now block readiness. Duplicate, absent, unknown, malformed, or manually approved gates are rejected. The eight human sign-offs remain `manual_required`, with `productionApproved: false`.

Database/Redis suites receive their isolated service settings in both the integration and release jobs. The release generator checks prerequisites before invoking suites that otherwise skip when unconfigured. Its RLS policy check runs with `ATLAS_APP_LOGIN_URL` and requires a non-superuser login. This closes the review finding where a successful process exit could conceal skipped database security tests.

Both artifacts upload even after failure, with candidate SHA, run ID, and attempt in their names; absent files fail upload and retention is 30 days. A workflow cancelled before artifact upload can still lack evidence and must not be treated as a successful release. Optional staging health/restore checks remain explicitly skipped when unconfigured, and are not proof those environments work.

### Local verification

| Check                                                              | Result                                                                                      | Evidence                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| CI, lint-rule, release-readiness, and release-security regressions | 542 passed; one existing optional certificate PDF-worker test skipped; 53 files passed      | [Final tests](audits/2026-09-20/f09-final-regressions.log)          |
| Workflow syntax and expression validation                          | Both workflows passed Actionlint 1.7.12; optional shellcheck/pyflakes integrations disabled | [Workflow check](audits/2026-09-20/f09-workflow-validation.log)     |
| F09 scripts and test lint                                          | Passed                                                                                      | [Lint](audits/2026-09-20/f09-final-lint.log)                        |
| TypeScript project build check                                     | Passed                                                                                      | [Typecheck](audits/2026-09-20/f09-typecheck.log)                    |
| Frozen offline lockfile consistency                                | Passed across 30 workspaces                                                                 | [Lockfile check](audits/2026-09-20/f09-lockfile-check.log)          |
| Existing stale release artifact                                    | Rejected as expected                                                                        | [Rejection](audits/2026-09-20/f09-stale-evidence-rejected.log)      |
| Actual generation from this dirty checkout                         | `NOT_READY`, zero claimed passes, no release commands executed                              | [Local evidence](audits/2026-09-20/f09-local-release-evidence.json) |
| Independent implementation review                                  | No remaining blockers after prerequisite fix                                                | Review recorded in this task                                        |

Regression fixtures exercise failed/cancelled/skipped security results, missing event-related gates, malformed data, stale/wrong-SHA/wrong-run evidence, dirty checkouts, missing service prerequisites, and restricted RLS execution. Synthetic fixtures use temporary Git repositories and fake command outcomes; they do not represent a hosted production candidate. The first broader local run hit pnpm cache access restrictions; rerunning with access to the installed cache passed without weakening checks.

## Remaining acceptance and operational impact

Follow [the CI and release evidence runbook](../runbooks/ci-release-evidence.md) when publishing the combined candidate. A clean, committed candidate must execute all required jobs on GitHub, upload fresh matching artifacts, and demonstrate a deliberately failed security/event test makes `ci-required` fail. Local negative tests prove the gate logic, not GitHub execution. Full database, Redis, Supabase, browser, build, and drill execution were not performed for this F09 validation.

Making `ci-required` an enforced branch rule belongs to F10 and was not changed here. No hosting configuration, production database, credentials, or repository visibility was changed. Existing schema-1 generated release artifacts must be regenerated; the validator intentionally refuses to accept or upgrade stale results. Human release approval and environment-specific checks remain separate obligations.
