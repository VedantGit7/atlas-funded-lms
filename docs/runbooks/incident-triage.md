# Incident Triage Runbook

## First 10 minutes

1. Confirm scope: single tenant, platform, or worker pipeline.
2. Capture `x-request-id` from failing request or health probe.
3. Check `/api/v1/health` for target environment.
4. Review Sentry for new issues tagged with `routeGroup` or `jobName`.
5. Review structured logs for `route.failure` or `worker.cycle.failure`.

## Tenant isolation suspected

- Do not use observability data as authorization proof.
- Run existing tenant isolation and authorization test suites.
- Verify host-based tenant resolution unchanged.

## Communication

- SEV-1: status update every 30 minutes until mitigated.
- Include request ID in internal incident notes only (not public posts with PII).
