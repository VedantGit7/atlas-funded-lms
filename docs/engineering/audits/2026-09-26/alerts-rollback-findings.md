# Rollback and alert reliability evidence — 2026-09-26

This work verifies local tooling behavior. Hosted deployment recovery and delivery to an alert recipient remain unproven.

## Reproduced verifier defects

- `rollback-verify.mjs` previously returned success without a release identity. It also returned success when `--verify-health` was supplied with a still-running candidate because it did not interpret that flag or contact the endpoint.
- Its documented runbook/owner checks were preflight checks only, without a machine-readable evidence scope.
- `restore-validate.mjs` previously sent the base URL through a Windows shell, printed it without removing credentials/query fragments, and invoked local tenant manifest checks plus a tenant-isolation package script loading `.env.test`. That base URL did not select the database tested by the package script.
- Eight initial regression cases failed before the fix. In that initial reproduction, the original restore wrapper attempted its four package commands, all reported failed; because it discarded child output, the reproduction does not establish whether any command reached a database. Subsequent verifier runs use the replacement's health-only path, without package/DB commands.

## Changes and verification

Rollback preflight now requires a target, labels optional owner checks, and always reports `rollbackProven: false`. `--verify-health` requires distinct candidate/rollback labels and checks the observed target identity through the existing release-health verifier. It does not perform a deployment or prove artifact immutability.

Restore validation now requires an explicit `RESTORED_ENV_EXPECTED_RELEASE`, runs only bounded HTTP application health checks through the same Node executable without a shell, strips URL query/fragment data, rejects URL credentials and non-loopback HTTP, and always reports `restoreProven: false`. The helper bounds execution and output and discards child error/response content.

The scoped Node test suite passed **14/14** cases. It covers missing identities, unchanged candidate, distinct target success, strict production owners, stalled/redirect/malformed/503 responses, unexpected restored identity, timeout validation, and URL/response redaction. See `alerts-rollback-verifiers-green.log`. Scoped ESLint and `git diff --check` passed; Git emitted line-ending normalization warnings only. Formatting emitted the existing module-type warning from `prettier.config.js`.

The executable `scripts/reliability/alerts-rollback-local-drill.mjs` produced `alerts-rollback-local-drill.json`. It:

- Starts a synthetic release HTTP endpoint in a real subprocess and verifies the candidate identity.
- Rejects the rollback identity while the candidate is still running, rejects an HTTP failure and stopped process, then restarts the candidate on the same origin.
- Stops that process and starts the previous fixture identity on the same origin; rejects candidate health and accepts rollback target health.
- Uses the actual worker health server to observe startup grace, stale liveness (503 while readiness stays 200), recovered synthetic progress, and draining readiness (503).
- Uses the actual heartbeat sender against a local receiver returning 503 then 204, observes the warning and subsequent HTTP receipt, and asserts the synthetic secret heartbeat URL is absent from child output.

The saved process IDs and measured local timings are fixture evidence only. No production application artifact was started. Sweep progress and the release endpoint are synthetic; no real worker jobs are processed. The worker-health implementation opens its usual listener; all drill requests target loopback. No provider alerts or messages to people were sent. The report explicitly sets hosted deployment, production artifact, database recovery, provider alert delivery, and human acknowledgement proof to false.

## Open hosted requirements

The managed-node Compose example's worker healthcheck can mark a running container unhealthy, but `restart: unless-stopped` does not by itself restart that unhealthy process. No API healthcheck is present in that example. Startup grace and draining readiness also do not prove dependency readiness or successful work. Prove the selected host's routing, unhealthy-instance replacement, API readiness and graceful shutdown behavior using the actual deployed services.

Static observability configuration checks and disabled/skipped smoke output are not provider delivery evidence. Reconcile the monitor template's five-minute heartbeat grace with the ten-minute missing-heartbeat severity criterion in the selected staging provider. An authorized alert drill must capture provider incident/recovery records, delivery receipt, and responder acknowledgement for the actual configured route. A loopback 204 cannot satisfy this gate.
