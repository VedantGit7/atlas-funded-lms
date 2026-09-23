# F08 durable outbox delivery and retries

## Authorized design and implementation plan

The user requested implementation of audit finding F08. Preserve F01–F07. Implement the audit's short transaction, lease, delayed retry and destination-specific replay design in the existing PostgreSQL worker. A separate queue service would add deployment dependencies without resolving handler idempotency; an in-memory retry loop would lose state on restart. This implementation uses persistent per-event/per-destination jobs and retains append-only outbox, delivery-attempt and dead-letter evidence.

1. Reproduce immediate dead-lettering despite a positive retry budget. Add behavioral and real isolated PostgreSQL tests for commit boundaries, delayed retries, claim races, stale result fencing, rollback, tenant isolation and destination-only replay.
2. Add migration 109 for `outbox_delivery_jobs`, tenant/platform policies, due-work indexes, immutable delivery attempt numbering and conservative backfill of historical terminal outcomes. Failed legacy deliveries remain held, not automatically redelivered by deployment.
3. Replace `processOutboxBatch(tx, args)` with `processOutboxBatch({ transaction }, args)`. Materialize/claim each delivery in a committed short transaction, invoke its handler outside, and record the outcome in another transaction. Persist attempts, retry budget, lease token/deadline and exponential backoff with jitter. `maxRetries` means retries after the initial attempt. Use stable event/destination identities across retries and replay. Unknown non-idempotent external outcomes require reconciliation.
4. Adapt all API/web consumer routers to the new boundary. Split notification preparation/send/record phases, bound SMTP calls and distinguish definite rejection from uncertain acceptance. Keep external report delivery outside database transactions and record each recipient/destination separately so a later failure does not resend earlier successes.
5. Replace broad event republishing on dead-letter replay with resetting only the failed destination's job, retaining original event/provider identity and append-only history. Reject stale and unresolved ambiguous replay, audit accepted requests, and make repeated replay of the same dead letter harmless.
6. Run focused/broad tests, schema validation, type/lint/guards and independent review. Update the audit and operational runbook with evidence and deployment requirements. No live sends, production migration or deployment are part of local verification.

## Acceptance and limits

Transient failure retries only when due and stops after its persisted budget. Permanent failure stops immediately. Worker crashes cannot lose claims; expired claims recover only according to the handler's declared retry safety. Stale workers cannot overwrite a newer result. A dead-letter replay never reruns another destination that succeeded. SMTP Message-ID and webhook idempotency headers are correlation/deduplication aids, not an exactly-once guarantee for arbitrary external systems. Ambiguous non-idempotent delivery is held for operator reconciliation.

Database policy follows [Supabase's RLS and grants guidance](https://supabase.com/docs/guides/database/postgres/row-level-security); concurrent claims use [PostgreSQL row locking](https://www.postgresql.org/docs/current/sql-select.html).

- [x] Reproduction and core migration/workflow
- [x] Consumer and external delivery integration
- [x] Replay and failure recovery coverage
- [x] Verification, review and rollout documentation

## Implemented behavior

Migration 109 creates tenant-isolated `outbox_delivery_jobs` with one row per event and destination. Each job persists its retry budget, lifetime and current-cycle attempts, next due time, lease token/deadline, outcome and replay identity. Existing successful/cancelled deliveries become terminal jobs. Every other historical delivery is held for reconciliation because the old implementation cannot prove whether its external effect happened. Deployment does not blindly retry legacy failures.

Claims use row locks with `SKIP LOCKED`, commit before invoking the handler, and receive a five-minute lease renewed every minute through a separate short transaction. Results are committed separately and require the current lease token. Stale workers cannot overwrite newer results. A result-commit failure leaves the job leased for recovery instead of incorrectly recording a handler failure. Append-only delivery attempts and dead-letter evidence are retained separately from mutable scheduling state. Application and worker roles cannot delete jobs or edit delivery evidence; RLS checks both tenant scope and ownership of the referenced event/report run.

`maxRetries: 3` means at most four attempts in a cycle. The budget is frozen when the job is created. Transient failures schedule exponential backoff with jitter, starting at 2.5–5 seconds and capped at 30–60 minutes. Permanent failures stop immediately; exhaustion creates a dead letter. An uncertain external result or an interrupted non-idempotent handler enters `reconciliation_required`. Stored error codes are constrained and raw provider errors are not written to delivery evidence.

Replay resets only the requested dead destination's job. It preserves the original event, destination identity and provider key, resets the cycle budget, retains lifetime attempt history and records an audit event. Repeating the same replay request is harmless; stale dead letters and uncertain outcomes cannot trigger ordinary replay. Previously successful destinations never rerun merely because another destination was replayed.

All 20 API/web batch entry points now supply a transaction factory. Notification preparation, external delivery and receipt recording have separate boundaries. SMTP uses a stable Message-ID and explicit connection/socket/overall deadlines. Definite temporary rejection can retry; permanent rejection stops; partial acceptance, timeout and unknown outcomes are held. A Message-ID is not proof of provider deduplication.

Marketing webhooks freeze separate destination jobs so one endpoint's failure does not replay another endpoint's success. Marketing workflow emails now publish a dedicated `marketing.workflow_email_requested` event with fixed recipient, body, headers and run/node identity. SMTP is performed by its child worker outside the workflow transaction. Workflow completion represents completed scheduling; `QUEUED`/`SENT` action logs and the delivery job describe actual email delivery. Queue errors propagate rather than masquerading as successful sends.

Migration 110 adds `report_delivery_effects`. A report's recipient/destination plan is frozen before any send; each effect has its own receipt and lease. Later attempts skip successes and held/permanent effects. Temporary failures continue retrying even when a different recipient is permanently failed or held; once eligible work finishes, the parent surfaces the remaining terminal outcome. Frozen signed links are checked for expiry before delivery and are never silently refreshed under the same identity. Generating a new report is required for expired links. Report generation and data-rights exports use short claim/snapshot/finalize transactions, perform uploads outside them, bound R2 upload requests to 30 seconds, and preserve cancellation. An already-running generation job is held rather than taken over while its original process might still run. The local data-rights storage path now writes the artifact bytes. Both report event names are registered and tested through the real outbox publisher.

PostHog jobs now await an HTTP capture acknowledgment, preserve the original event UUID and propagate transport, rejection and quota failures. The installed Node SDK catches errors even in `captureImmediate`, so it cannot serve as the durable acknowledgment boundary. Optional analytics without a configured key does not register false-success jobs. This follows PostHog's [capture API](https://posthog.com/docs/api/capture); provider ingestion acceptance is not a guarantee about subsequent analytics processing.

## Verification evidence

Evidence is saved in `docs/engineering/audits/2026-09-20/`:

- `f08-retry-red.log`, `f08-lease-red.log`, `f08-posthog-red.log`, `f08-report-events-red.log`: regression reproductions before their respective fixes.
- `f08-postgres.log`: **16 passing real local PostgreSQL tests** in a randomly named isolated schema. Applies migrations 109 and 110, checks historical backfill, due-time retries, frozen budgets, permanent failure, concurrent claims, claim/result rollback, unsafe crash recovery, stale-worker fencing, destination-only/idempotent replay, tenant binding, append-only evidence and frozen report receipts. The fixture drops its temporary schema; development business tables and production were not migrated.
- `f08-regressions.log`: **2,172 passing tests across 296 files** covering unit, security, events and the dead-letter replay API. This run includes the workflow/export/PostHog changes and precedes the final two mixed-report tests and two report-publication tests.
- `f08-final-focused.log`: **26 passing tests across five files**, covering the final mixed-recipient retry fix, report event publishing, report effects and PostHog delivery acknowledgment.
- `f08-typecheck.log`, `f08-lint.log`, `f08-prisma-validate.log`: project TypeScript, scoped F08 lint and Prisma schema validation. Final changed files are rechecked after review fixes.
- `f08-guards.json`: eight repository guards covering route metadata, Prisma boundaries, audit/outbox compliance, worker registration, secrets and approved/transaction-scoped SQL.
- `f08-verification.json`: check results, limitations and source hashes for the locally verified working tree. This is local evidence, not a replacement for candidate-SHA CI/release evidence under F09.

Independent review identified and closed unsafe legacy replay, report link expiry, recipient starvation (including mixed permanent/transient failures), workflow SMTP inside a transaction, data-rights upload inside a transaction, analytics acknowledgment and missing report event registrations. Tests simulate providers; no live email, webhook, analytics event or customer export was sent.

## Rollout and limits

Local remediation is complete. Apply migrations **109 and 110** before running the matching API/web/worker version. Stop old worker instances during migration and coordinated rollout because the delivery uniqueness/index contract changes. Production deployment, migration and staging provider acceptance have not been performed. See the [outbox delivery runbook](../runbooks/outbox-delivery.md) for monitoring, recovery and rollback.

No universal exactly-once external-delivery claim is made. SMTP and arbitrary webhooks without guaranteed deduplication require operator investigation after uncertain acceptance. The implementation intentionally favors a visible held job over a blind duplicate. A process interrupted before its first send may also be held conservatively. There is no self-service reconciliation override. Frozen permanent report effects are not reset by ordinary parent replay, and expired links require a new report run. Confirm earlier deliveries before issuing any replacement.

Future operational work should set queue-age/reconciliation SLAs, install alerts using the persisted states, and validate throughput and query plans with staging-sized history. The current materializer is bounded but scans subscribed historical events to find missing jobs; a tenant-safe incremental materialization cursor can be considered after measuring it. Retention and archival must preserve receipt/replay identities. Full browser/provider end-to-end testing and full release CI remain separate rollout gates.
