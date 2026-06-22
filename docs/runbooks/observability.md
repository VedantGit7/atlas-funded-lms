# Observability Runbook

## Environment separation

- Development: telemetry optional, hash salt optional
- Staging: full wiring validation via `pnpm observability:check` and `pnpm release:health`
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

## Dead-letter investigation

Use existing outbox/dead-letter tooling. Observability logs include `requestId` from outbox metadata but do not replace audit or replay workflows.

## Provider checklist (manual)

- [ ] Sentry DSN configured for web deployment
- [ ] PostHog project key configured (public + server)
- [ ] Better Stack log drain attached to deployment
- [ ] Health and heartbeat monitors created from template
- [ ] Alert recipients configured per alert policy
