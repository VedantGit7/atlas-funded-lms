# Rollback Runbook

## Identify rollback target

Release health prints `rollbackTarget` from `RELEASE_SHA` or `RELEASE_VERSION`.

## Steps

1. Stop promotion pipeline for current release.
2. Redeploy previous known-good artifact/tag recorded in deployment history.
3. Run `pnpm release:health` against staging, then production only when approved.
4. Verify health monitors green and worker heartbeat resumes.
5. Monitor Sentry error rate for 30 minutes post-rollback.

## Do not

- Roll back by mutating observability provider dashboards.
- Disable tenant isolation, RLS, or auth gates as a mitigation.
- Store provider secrets in the repository during rollback.
