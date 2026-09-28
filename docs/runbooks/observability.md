# Observability Runbook

## Environment separation

- Development: telemetry optional, hash salt optional
- Staging: `pnpm observability:check` validates source/configuration references; `pnpm release:health` observes HTTP release identity. Neither proves full provider wiring or alert delivery.
- Production: `OBSERVABILITY_HASH_SALT` required; providers configured in secret store only

## Correlation procedure

1. Collect `x-request-id` from user report or API error envelope.
2. Query log drain for `requestId`.
3. Open Sentry issue search with `requestId:` tag.
4. If worker-related, also search `parentRequestId`.

## Worker heartbeat investigation

1. Confirm `BETTER_STACK_WORKER_HEARTBEAT_URL` exists in worker environment.
2. Check structured logs for `worker.heartbeat.failed` or `worker.heartbeat.error`.
3. Heartbeat failures are warn-only and do not stop outbox processing.
4. Confirm a successful heartbeat request after recovery from provider-side receipt timestamps. The sender does not log a recovery event; absence of warning is not evidence of delivery.
5. `/healthz` grants a startup grace window before any completed work. A 200 during this window does not prove useful progress. `/readyz` currently reports draining state only and can remain 200 while liveness is 503; it does not validate database availability.

## Dead-letter investigation

Use existing outbox/dead-letter tooling. Observability logs include `requestId` from outbox metadata but do not replace audit or replay workflows.

## Provider checklist (manual)

- [ ] Sentry DSN configured for web deployment
- [ ] PostHog project key configured (public + server)
- [ ] Better Stack log drain attached to deployment
- [ ] Health and heartbeat monitors created from template
- [ ] Alert recipients configured per alert policy

## Alert delivery acceptance

Use an explicitly authorized staging failure window and recipient route. Record the monitor identity/environment, evaluated failure threshold and grace period, failure start, provider incident creation, notification receipt, named responder acknowledgement, recovery time and recovery notification. Keep provider secret URLs, tokens, sensitive payloads and recipient personal details out of committed reports.

Verify both HTTP outage and missing-heartbeat detection, including the configured grace period; a failed outgoing heartbeat request alone does not demonstrate a missing-heartbeat incident. Reconcile the template's five-minute heartbeat grace with the severity policy's ten-minute missing-heartbeat criterion in the actual provider configuration. A locally accepted HTTP request proves transport to that receiver only. It cannot establish provider evaluation, escalation, delivery to a person or acknowledgement.

`node scripts/reliability/alerts-rollback-local-drill.mjs` provides bounded local failure/recovery checks for the real heartbeat sender, with a 503 then 204 loopback receiver and secret-URL redaction assertions. It sends no provider or human alerts. Its report keeps `providerAlertDeliveryProven` and `humanAcknowledgementProven` false.

`scripts/observability/staging-smoke.mjs` is disabled unless `OBSERVABILITY_SMOKE_ENABLED=true`; a skipped wrapper result is not staging evidence. `validate-env.mjs` records configuration presence only. Require live observations and the recipient evidence above before declaring operational alert readiness.
