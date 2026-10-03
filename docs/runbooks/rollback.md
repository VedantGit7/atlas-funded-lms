# Rollback Runbook

## Identify rollback target

Record the candidate and previous known-good immutable artifact digests from deployment history. `RELEASE_CANDIDATE_RELEASE` identifies the candidate; `ROLLBACK_TARGET_RELEASE` identifies the previous release. The verifier also accepts `RELEASE_SHA` or `RELEASE_VERSION` as legacy target inputs. These labels must match the application's health identity, but a label alone does not prove an immutable artifact was deployed.

The JSON `rollbackTarget` field records the selected target identity. Independent `pnpm release:health` checks must use that target as the required expected release.

`pnpm release:rollback:verify` is a preflight only. It fails without a target, checks the runbooks, and reports `evidenceScope: preflight-only` and `rollbackProven: false`. Add `--strict-production` to require `RELEASE_OWNER` and `INCIDENT_OWNER`. A successful preflight is not a completed rollback.

## Steps

1. Stop promotion pipeline for current release.
2. Capture candidate health and deployment identity, then redeploy the previous known-good artifact/digest recorded in deployment history. Keep the deployment operation ID, start/end timestamps, environment, and API/web/worker identities. Confirm migration compatibility before switching binaries; binary rollback does not undo database changes.
3. Set `RELEASE_HEALTH_BASE_URL`, `RELEASE_CANDIDATE_RELEASE`, and `ROLLBACK_TARGET_RELEASE`, then run `pnpm release:rollback:verify --verify-health`. It requires distinct identities and makes bounded health requests expecting the rollback target. It reports `target-health-only` and still `rollbackProven: false`: deployment history and before/after evidence supply the actual switch proof. Run against staging, then production only when approved.
4. Verify dependency readiness, useful worker progress, and resumed heartbeat separately. Capture authorized provider incident/recovery records and recipient acknowledgement; HTTP 200 and a local heartbeat receiver cannot prove alert delivery.
5. Monitor Sentry error rate for 30 minutes post-rollback.

## Do not

- Roll back by mutating observability provider dashboards.
- Disable tenant isolation, RLS, or auth gates as a mitigation.
- Store provider secrets in the repository during rollback.

## Local evidence and hosted acceptance

Run `node scripts/reliability/alerts-rollback-local-drill.mjs` with the repository's pinned Node runtime and installed dependencies. It kills and restarts local fixture processes on the same origin and replaces a candidate identity with a previous fixture identity. It exercises the real worker health server and heartbeat sender; the release endpoint and sweep progress are synthetic. Output explicitly excludes production artifacts, database recovery, hosted deployment, provider alerts, and human acknowledgement.

The managed-node Compose example uses `restart: unless-stopped`; this restarts exited processes, not a still-running container merely marked unhealthy. Its worker healthcheck records liveness only, and the example has no API healthcheck. Before hosted acceptance, configure the host's unhealthy-instance restart mechanism, API dependency readiness, worker startup allowance, routing/drain behavior and shutdown grace. Prove them on the actual host with separate process termination and alive-but-stalled failure drills. Do not treat this local subprocess drill as evidence that the host is configured correctly.

## Restore health scope

`pnpm release:restore:validate` requires `RESTORED_ENV_BASE_URL` and `RESTORED_ENV_EXPECTED_RELEASE`. It makes bounded application health probes only, never runs local tenant tests or loads `.env.test`, and always reports `restoreProven: false`. A successful response does not establish that a restore occurred or that restored data, tenant policies, backup integrity, RPO or RTO are correct. Attach separately authorized isolated database restore evidence.
