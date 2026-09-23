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

The local logs are under `docs/engineering/audits/2026-09-23/staging/`; log files are ignored by Git. Required commit/push checks and hosted results will be recorded after they run.

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

## Acceptance still outstanding

Hosted validation requires protected web/API ingress, isolated provider settings, matching release identities across web/API/worker, database isolation checks, operator MFA, tenant access checks, upload/download/SCORM and worker recovery checks. Then complete capacity, restore, rollback and alert drills using the actual staging resources.

The closure matrix's remaining CSP enforcement/compatibility, privacy retention and erasure decisions, measured capacity and learner bundle size, password-protection entitlement, SCORM orphan cleanup and repository protection gaps remain open. Local test success does not close them.

## Publication and CI

Pending candidate commit, push and draft pull request. This section must be updated with observed outcomes; missing runs or rejected jobs are not passes.
