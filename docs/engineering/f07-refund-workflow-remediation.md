# F07 durable refund workflow

## Approved objective and design

The user requested F07 from the comprehensive audit. Replace request-transaction money movement with a durable tenant-scoped refund intent. Preserve earlier F01–F06 changes. No real payment/refund or production migration is authorized by this code remediation.

Serialize reservations by locking the payment order. Persist a permanent client request UUID plus a payload fingerprint, exact amount, original gateway identity, state and provider idempotency key. Only a committed requested intent can be dispatched. The worker claims a five-minute lease in a short transaction, calls the provider outside the transaction, then records the result in another short transaction. A crash/timeout/unknown result is reconciled using read-only provider lookup; it is never blindly resubmitted. Pending and ambiguous amounts remain reserved.

The state set is requested, processing, pending, succeeded, failed, reconciliation_required and manual_adjustment. Confirmed success appends one ledger projection and applies the requested course-access policy atomically. Failed provider refunds release reservations without revoking access. Manual adjustments require a reference, make no provider call and are labelled separately. Legacy records remain labelled legacy_recorded and continue consuming balance conservatively. No fictional learner notification is reported as queued.

Signed provider refund webhooks only wake the same tenant/gateway-bound intent for read-only reconciliation. Editable callback metadata cannot establish payment ownership or apply financial/access effects. The original gateway lookup independently checks the real payment ownership, intent identity, amount and currency. Replays and stale pending/failure callbacks cannot duplicate ledger/access effects. Refunds use their own durable queue to avoid depending on the general outbox retry issue tracked by F08.

- [x] Reproduce unsafe request-side gateway/access effects.
- [x] Add intent persistence, tenant RLS, order-locked reservations and duplicate-request fingerprint checks.
- [x] Add bounded provider submission/read-only reconciliation and signed callback handling.
- [x] Wire the worker and UI state/explicit manual adjustment behavior.
- [x] Verify real local Postgres concurrency, rollback, isolation and replay; provider fixtures never move money.
- [x] Run regressions, TypeScript, lint/guards and independent review; record rollout requirements.

## Implementation

`payment_refund_intents` stores the tenant/order identity, permanent request UUID and fingerprint, exact amount/currency, original gateway identity, provider reference and reconciliation state. A tenant/order lock serializes reservations against confirmed ledger entries and all active intents. Tenant RLS is enabled and forced; anonymous/public access and application/worker DELETE are denied. Baseline grants preserve these restrictions.

The refund request service persists intent without calling a provider or revoking enrollment. The worker commits its lease before making external calls and commits verified outcomes afterward. Stripe and Razorpay submissions carry the stable intent-derived idempotency key and explicit amount. Adapter calls have a 20-second timeout; provider lookups are bounded. The original gateway key and ID must match, preventing fallback to another tenant gateway. Confirmed success and the ledger/access projection are atomic and deduplicated. A confirmed provider failure releases the reservation; an exception or mismatch does not.

The UI retains a request UUID for unchanged retry payloads, blocks concurrent submission, and labels requests, pending results, failures, manual adjustments and legacy records separately. Manual adjustments require a reference and do not call a gateway. Refund detail, list and summary calculations subtract reservations; list history loads intents in one batched query rather than a query per order. Existing gateway IDs survive ledger serialization. Removed obsolete instructions that told operators to issue a second manual refund.

## Verification and review

Evidence is in `docs/engineering/audits/2026-09-20/`:

- `f07-boundary-red.log`: two failing tests reproduced request-side money/access effects before implementation.
- `f07-postgres.log`: **13 passing real local PostgreSQL tests**, using a randomly named isolated schema and application role. Exercises concurrent partial reservations, permanent duplicate keys, request rollback, tenant RLS, timeout-after-success, outcome rollback, worker leases, callback forgery/replay, wrong gateway rejection, failure balance release, manual ledger dedupe and reservation-aware SQL queues. The temporary schema was dropped after testing; production and development business tables were not migrated or modified.
- `f07-focused.log`: provider adapter, actual request/detail/list service, DTO and rendered UI tests. The 11 service tests keep real schemas/fingerprinting/record mapping while mocking I/O; they cover request replay/conflict, full-refund balance reservation, manual reference validation and batched status projection. These are not a complete HTTP/browser/provider end-to-end test.
- `f07-regressions.log`: **2,076 passing tests across 283 files** in the broader unit/security/event suite. This run preceded the 11 additional service tests; final focused checks include those tests.
- `f07-typecheck.log`, `f07-lint.log`, `f07-prisma-validate.log`: successful project TypeScript, targeted implementation lint and Prisma schema validation. UI/adapters/service-test lint also passed independently.
- `f07-guards.json`: eight passing guards for route metadata, Prisma boundaries, audit/outbox compliance, worker coverage, secrets and approved/transaction-scoped SQL.
- `f07-verification.json`: final evidence summary and source hashes. Working-tree diff whitespace check passed.

Independent review identified and closed four gaps: editable callback metadata could falsely establish payment identity; default-gateway fallback could select the wrong gateway; legacy UI advice could induce a second refund; list/summary balances omitted reservations. Re-review found no remaining significant correctness/security blocker in the reviewed scope.

## Rollout and remaining limits

Local implementation is complete. Production rollout has not been performed. Apply migration 108 before deploying matching API/web/worker versions, then run provider test-mode acceptance and verify worker health. The [refund operations runbook](../runbooks/refunds.md) covers monitoring, reconciliation and rollback. No live payment/refund was executed.

Unknown outcomes deliberately retain reservations and receive read-only checks, never an automatic second submission. If the process dies before its first external call, or bounded lookup cannot find an older provider record, an operator must investigate. There is no self-service reconciliation override or refund-notification delivery in this release. Monitor aged intents with an operational SLA; the broader outbox retry defect remains F08. Legacy ledger entries are not retrospectively certified as provider-confirmed refunds.
