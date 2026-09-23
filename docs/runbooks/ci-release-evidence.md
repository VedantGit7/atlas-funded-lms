# CI and release evidence

## Candidate checks

Publish the reviewed remediation as a committed candidate through the normal repository process. Open a pull request, push to a configured CI branch, or manually dispatch CI against that candidate. `ci-required` must run and succeed after all 34 required jobs succeed. The optional health job may be skipped only when its environment is unconfigured; if it runs and fails, the aggregate fails.

Inspect the run's job list. A failed workflow with zero jobs is an admission/dispatch problem, not proof that tests ran. Read GitHub's workflow annotations and resolve the actual reported cause. The local `workflow-validation` job cannot execute if the workflow itself is rejected, so validate workflow edits locally with Actionlint as well.

Download both artifacts from that run:

- `ci-evidence-<candidate-sha>-<run-id>-<attempt>` contains `ci-evidence.json`, schema `1`, type `ci-aggregate`.
- `release-evidence-<candidate-sha>-<run-id>-<attempt>` contains `release-evidence.json`, schema `2`, type `release-suite`.

Check the full SHA, run ID, attempt, timestamp, gate results, and blockers against the selected GitHub run. For pull requests and merge queues, use the actual tested candidate/merge SHA reported by the workflow. A prior attempt or branch-head artifact is not interchangeable. Artifacts are retained for 30 days; archive approved release records through the organization's retention process before expiry. Missing evidence is not a pass, including when cancellation prevents uploads.

## Generating and validating release evidence

Run `pnpm release:suite` only from a clean committed checkout connected to disposable test services. It executes the complete release suite and can mutate its configured test database. Supply `DATABASE_URL` and `PLATFORM_DATABASE_URL` for the isolated database, `ATLAS_APP_LOGIN_URL` for its restricted application login, `F03_TEST_DATABASE_URL`, `F07_TEST_DATABASE_URL`, `F08_TEST_DATABASE_URL`, and `F04_TEST_REDIS_URL` for their isolated service tests. CI provisions these services and the restricted login before running the suite.

Use `pnpm release:evidence:validate` to validate the generated artifact. `RELEASE_EVIDENCE_PATH` selects a different file; the default is the ignored root `release-evidence.json`. Validation binds evidence to the current clean checkout and, inside GitHub Actions, the current run and attempt. It defaults to a 24-hour maximum age. Do not manually edit timestamps, verdicts, gate outcomes, or SHA values to make evidence pass.

Required failed or skipped checks, missing service prerequisites, dirty source, changed HEAD, invalid provenance, or malformed gate data produce `NOT_READY`. Legacy schema-1 release artifacts must be regenerated. The `--skip-db`, `--skip-build`, and `--skip-e2e` flags may assist investigation, but cannot produce release-ready evidence when they skip mandatory gates.

Set `RELEASE_HEALTH_BASE_URL` and `RESTORED_ENV_BASE_URL` when the respective environments are available. If absent, their gates remain explicitly skipped. Automated readiness never approves production: legal readiness, monitoring, restore drill, rollback target, domain/SSL, secrets review, incident owner, and CTO approval require human sign-off.

## Verifying failure enforcement

On an isolated test branch, temporarily introduce a deterministic failure in a security/event test that a mandatory job executes. Confirm the test job fails, downstream build cannot pass, `ci-required` fails, and its artifact records the failed/skipped dependencies. Revert that deliberate failure, run a clean candidate again, and retain both run links. Do not merge the intentional failure or treat local synthetic fixtures as this hosted demonstration.

The workflow's always-run aggregate is designed to expose missing or skipped mandatory jobs. To enforce it for merges, configure `ci-required` as a required check under the repository protection work in F10; adding a workflow alone does not establish merge enforcement.

## Maintaining the gate

Use the exact Node version in `.node-version` for local candidate checks. CI and drills read that file; the managed API/worker Docker bases must use the matching patch version. The September 2026 candidate pins Node 24.21.0 and accepts Node 24.15.0 through 24.x in `engines.node`: the locked DOM sanitizer and jsdom require at least 24.15.0. Do not disable `engine-strict` to accommodate an older runtime. The CI regression checks the pin against all locked packages applicable to Linux x64 and verifies workflow/container alignment. Vercel selects the current patch within the declared major, so record its actual build/runtime version separately.

When adding or removing a CI job, update `scripts/ci/required-jobs.json`, the `ci-required` dependency list, and the build dependencies together. Every non-aggregate job must be registered. Keep only explicitly optional environment checks in the optional list. Run `tests/ci/ci-gate.test.ts` and `tests/unit/release-readiness` after changes.

Keep action references pinned to reviewed commit SHAs. Review Dependabot updates and tool-version/checksum changes through CI. Do not bypass failing security, event, migration, browser, or release checks to obtain a green aggregate.
