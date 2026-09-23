# Staging release preparation — 23 September 2026

## Decision

The F01–F22 work is a staging release candidate, not a production approval. Publication and hosted CI status are recorded below as they become available. No hosted staging deployment, DNS change, paid subscription, or production promotion has been performed.

Candidate branch: `release/atlas-staging-20260923`. Starting commit: `ca8c0f1e7e69780b4e2ddc2a1136907a2e47c350`. Fetched main: `d15794708e6a2d0231286612e4bc573e92deb619`. The working source matched the 22 September verification fingerprint before today's release-preparation edits. The historical verification remains in [the closure matrix](f01-f22-closure-matrix.md); it is not hosted CI evidence for the forthcoming candidate commit.

## Changes and fresh verification

- Fixed a real dependency-engine mismatch: CI and drills now read Node 24.21.0 from `.node-version`, all managed-node Docker stages use that version, and package engines require Node `>=24.15.0 <25`. The locked dependency set no longer conflicts with the selected Linux/x64 runtime. The downloaded Windows runtime matched the official Node distribution SHA-256.
- Fixed missing F16 browser evidence uploads by enabling hidden-file inclusion for the exact evidence file and browser report paths. Credentials and neighboring test-state directories remain outside the upload selection.
- Added regression coverage for the runtime compatibility and artifact scope. The affected CI/release/deployment set passed 93 tests across five files. Actionlint passed both workflows; scoped lint and formatting passed. An independent read-only review found no blockers in these changes.
- Frozen dependency installation passed under Node 24.21.0 without changing the lockfile. Prisma generation and package preparation completed. Source-secret checks and lint-shard coverage passed.
- Excluded local editor connection settings from Git. Synthetic test URLs and the local TLS test fixture remain intentional test inputs.
- Prepared [the staging deployment checklist](../../deploy/staging/README.md), including proposed addresses, isolated resources, build secrets, configuration validation, ingress, worker health, migration, rollback and acceptance requirements.

The frozen-install/source-guard logs are under `docs/engineering/audits/2026-09-23/staging/`; log files are ignored by Git. The focused 93-test and Actionlint results were recorded in the review task's tool transcript. All eighteen staged lint/format batches and the repository type check passed during the commit. The hook emitted a generated-file restaging warning because already-tracked Prisma output also matches an ignore rule; the commit succeeded and an independent comparison confirmed no residual working-tree changes. Push checks and hosted results are recorded below when available.

The workstation's global Node remains 24.11.1. Verification used the checksum-verified portable 24.21.0 runtime under `.test-results/node-v24.21.0/`. Developers must select the version in `.node-version` before using the repository's package commands; this task did not replace the global runtime.

## Fresh account and infrastructure checks

| System                  | Observed status                                                                                                                                   | Required next action                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub                  | Existing private repository is accessible; authenticated fetch works. Ruleset API returns 403 with a private-repository plan upgrade requirement. | Publish the candidate and inspect CI. Account owner must resolve plan/admin prerequisites before required merge protection can be enabled.                      |
| Vercel                  | Connected app lists no teams and returns 403 for the Atlas project team.                                                                          | Reconnect Vercel with access to `vedantwedhane-8075s-projects`.                                                                                                 |
| Supabase                | The existing `atlas-funded-lms` project is healthy in Mumbai.                                                                                     | Explicitly designate or provision isolated staging Auth; a healthy existing project is not evidence of isolation or complete application database provisioning. |
| Cloudflare              | No callable Cloudflare connector tools or configured deployment credentials were available in this session.                                       | Provide access to the actual DNS zone and staging R2 resources.                                                                                                 |
| Managed API/worker host | No configured host was found. User confirmed purchase of `fundedbeyond.com` only.                                                                 | Choose and provision an always-running container host for the API and background worker.                                                                        |
| Browser fallback        | Browser automation failed twice during initialization because its kernel assets path was unavailable.                                             | Repair browser tooling if interactive provider setup is needed; this was not an account-authentication result.                                                  |

Purchasing the domain supplies an address. It does not provision the API, background worker, application database, Redis, private object storage, or monitoring. The staging checklist proposes subdomains while leaving the root domain and `www` unchanged.

Public DNS confirms Cloudflare nameservers `aaron.ns.cloudflare.com` and `elisabeth.ns.cloudflare.com`. This establishes the DNS provider, not write access to the zone. No DNS records were changed.

For the missing staging compute, Railway is a suitable proposed host because it can run the existing container images as separate services. This is an architectural recommendation, not a provisioned account. Its Hobby plan has a $5 monthly minimum with $5 of included usage; additional resource use costs extra, so $5 is not an estimate for the full Atlas deployment. The owner must connect an account and approve its spending settings before resources are created. See the official [service documentation](https://docs.railway.com/services) and [pricing](https://docs.railway.com/pricing/plans). Railway deployment health checks do not provide ongoing health monitoring; retain the external worker monitoring and restart requirements in the staging checklist ([health-check documentation](https://docs.railway.com/deployments/healthchecks)).

## Acceptance still outstanding

Hosted validation requires protected web/API ingress, isolated provider settings, matching release identities across web/API/worker, database isolation checks, operator MFA, tenant access checks, upload/download/SCORM and worker recovery checks. Then complete capacity, restore, rollback and alert drills using the actual staging resources.

The closure matrix's remaining CSP enforcement/compatibility, privacy retention and erasure decisions, measured capacity and learner bundle size, password-protection entitlement, SCORM orphan cleanup and repository protection gaps remain open. Local test success does not close them.

## Publication and CI

Remediation committed as `faa7064ba89a60929ad5c20df732f2416154b2a0`. Main reconciled cleanly; the merge introduced no source differences. Candidate `a3bcfff05dce76bc0974acfed24610a32a2eeb9c` was pushed to the dedicated release branch and published as [draft PR #95](https://github.com/VedantGit7/atlas-funded-lms/pull/95). The PR is attached to the task. Main remains unchanged.

The normal pre-push checks passed: 2,528 unit tests across 324 files, route metadata and Prisma boundaries. The [first PR CI run](https://github.com/VedantGit7/atlas-funded-lms/actions/runs/35826081404) was admitted and completed dependency installation successfully. Its actual tested merge SHA is `0e45de4fdcf0d201f7ba294242525c1fca70380e`. The duplicate push-triggered run `35826050238` was intentionally cancelled to avoid duplicate runner usage; that cancellation is not a test result.

The first hosted E2E job identified a source-packaging discrepancy: the locale coverage route existed locally but was absent from Git. This is why hosted clean-checkout validation remains necessary even after local success. The current PR check results and retained run evidence, rather than this initial publication snapshot, determine candidate readiness. Missing, failed or skipped mandatory jobs are not passes. The optional release-health job cannot verify a hosted environment until that environment exists.

## Hosted failures corrected in the follow-up candidate

The broad `coverage/` exclusion hid a real locale API route from Git, Docker, lint/format checks and source guards. Coverage exclusions now apply to generated reports at repository/workspace roots. The original route is included unchanged. Four regression tests demonstrate that product source is included while generated reports remain excluded, and that seven guards actually reject unsafe code under a product `coverage` path. Twelve locale/page-reachability tests, eight real guard checks, scoped lint and a real Docker context copy passed. Evidence: `.test-results/ci-coverage-route/`.

The integration job also exposed an order dependency in common tenant fixtures: roles were created before the global permission catalogue was available. A newly provisioned PostgreSQL 16 database reproduced eleven failures across four files (three other tests passed). The fixture now awaits the real idempotent catalogue seed before creating tenants; production authorization is unchanged. All fourteen tests then passed. A second freshly provisioned database with isolated Redis passed the full integration set: 106 files / 586 tests passed, three files / 15 tests explicitly skipped because their additional opt-in prerequisites were not supplied. These skips are not counted as successful validation. Guarded cleanup removed only the run-owned fixtures. An independent read-only review found no actionable issues in the fixture change.

Local reproduction evidence is `.test-results/staging-fresh-db-red.log`, `.test-results/staging-fresh-db-green.log` and `.test-results/staging-integration-green.log`. Hosted verification of the follow-up commit remains required; consult the draft PR's exact-commit checks and run artifacts before rollout.

The initial browser run passed 24 journeys and rejected platform tenant creation with `Invalid origin`. The CI browser environment lacked `PLATFORM_HOST`, unlike the verified local browser harness. The workflow now sets the canonical platform hostname and explicit matching browser base URL. A regression first reproduced the missing configuration. This fixes the harness configuration while preserving the application's origin checks.
