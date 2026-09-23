# Outbox delivery operations

## Deployment

F08 requires migration `20260920020000_109_outbox_delivery_jobs` and migration `20260920021000_110_report_delivery_effects`, followed by matching API, web and worker code. Stop all old delivery workers first. The delivery-attempt uniqueness contract changes from one row per destination to one row per attempt; old and new workers must not operate concurrently.

Apply through the normal reviewed migration pipeline, verify RLS and grants, then start one new worker and check progress before scaling out. Migration 109 preserves historical `SENT` and `CANCELLED` outcomes; other historical delivery rows are held for reconciliation. Do not bulk-reset those holds after rollout. Confirm that enabled processors include competency or gamification (their engagement factory includes workflow email), reports and data-rights. An absent optional PostHog key disables that subscription.

Staging acceptance must exercise temporary and permanent rejection, a process interrupted during delivery, result-recording failure, destination-only replay and multi-recipient partial failure with provider fixtures/test endpoints. No production migration or live delivery was executed during local F08 implementation.

## State and retry policy

| State                     | Meaning                                                              | Action                                                                   |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pending`                 | Durable work awaiting a worker                                       | Check age and worker subscription                                        |
| `processing`              | Worker owns a five-minute lease, renewed each minute                 | Check lease/worker health; do not reset a live lease                     |
| `retry`                   | Definite retryable failure; next attempt is scheduled                | Fix destination availability; let due-time retries run                   |
| `succeeded`               | Handler completion acknowledged and recorded                         | No replay needed                                                         |
| `dead`                    | Permanent rejection or exhausted current-cycle budget                | Investigate cause, then use authorized destination replay if appropriate |
| `reconciliation_required` | External acceptance is uncertain or historical evidence insufficient | Investigate provider/receipt evidence; ordinary replay is denied         |
| `cancelled`               | Preserved historical cancellation                                    | No automatic delivery                                                    |

The budget is persisted at job creation. `maxRetries=N` allows the first attempt plus N retries; later configuration changes do not expand an existing job's budget. Backoff starts at 2.5–5 seconds and grows exponentially with jitter, capped at 30–60 minutes. Replaying a dead letter opens a fresh cycle with the original budget, keeps lifetime attempts and uses the same event/destination identity.

## Monitoring

Use an authorized tenant database transaction to inspect these tables, or an authorized platform transaction for cross-tenant queue diagnostics. Do not use a tenant's browser client, disable RLS or expose frozen payloads in logs. The following reads are diagnostic examples for the existing transaction-scoped database tooling:

```sql
SELECT destination_key, status, count(*) AS jobs,
       min(created_at) AS oldest_created, min(next_attempt_at) AS next_due
FROM outbox_delivery_jobs
GROUP BY destination_key, status
ORDER BY destination_key, status;

SELECT id, tenant_id, outbox_event_id, destination_key, status,
       attempt_count, cycle_attempt_count, max_attempts,
       next_attempt_at, lease_until, last_error_code, last_dead_letter_id
FROM outbox_delivery_jobs
WHERE status IN ('dead', 'reconciliation_required')
   OR (status = 'processing' AND lease_until < now())
   OR (status IN ('pending', 'retry') AND next_attempt_at < now() - interval '5 minutes')
ORDER BY updated_at
LIMIT 100;
```

Report effect records require tenant scope; platform access to that table is intentionally not granted. Inspect only safe identifiers/state, without selecting the frozen recipient/message/request JSON:

```sql
SELECT report_run_id, effect_key, kind, status, attempts,
       lease_until, error_kind, last_error, updated_at
FROM report_delivery_effects
WHERE report_run_id = :report_run_id
ORDER BY ordinal;
```

Set operational thresholds for overdue work, held jobs and repeat failures before production rollout. Worker `failed` counters include retryable attempts, not just dead letters; compare them with persisted job status. A successful parent workflow may mean its email actions were queued, while the child delivery is still pending. Provider acceptance and inbox receipt are different stages.

## Replay and reconciliation

For a definite failed delivery, correct its cause and use the existing authorized platform dead-letter replay action. It targets the dead letter's event and destination; it no longer republishes the event to every consumer. Repeating the same replay is a no-op. Stale dead letters and `reconciliation_required` jobs are rejected. Do not work around the rejection by deleting evidence, publishing a replacement event or changing status manually.

For uncertain SMTP/webhook outcomes, collect the event ID, destination key, stable Message-ID/idempotency key, timestamps and provider records. Determine whether acceptance occurred. A stable key alone is not proof that an arbitrary provider deduplicates. Preserve the evidence and resolve through a reviewed, audited operational change; a self-service reconciliation override is not included. If acceptance cannot be established, escalate for a business decision before any replacement delivery.

Report fan-out retains completed recipients while retrying only eligible effects. A held/permanent recipient does not prevent another recipient's temporary failure from using the remaining parent retry budget. When eligible work completes, remaining held/permanent outcomes surface. Parent replay never clears held, permanent or successful effect receipts. Frozen signed links cannot be refreshed in place: an expired-link error requires a new report run, after checking earlier receipts to avoid duplicate delivery.

Report and data-rights jobs already marked `RUNNING` are conservatively held after interruption. Verify the original process and artifact before deciding how to recover; a lost outbox lease does not prove the uploader has stopped. Failed/cancelled jobs are not resurrected as successful. Local storage and R2 uploads occur outside the queue claim/result transactions.

## Rollback

Stop new workers if rollout is unhealthy and preserve queue/effect/attempt evidence. Prefer a forward fix. Do not restart old workers against the new attempt index or drop the new tables: doing so discards delivery identity/progress and can repeat external effects. Any database/code rollback requires a coordinated reviewed plan that accounts for deliveries made since migration. Inspect held and in-flight jobs before resuming.
