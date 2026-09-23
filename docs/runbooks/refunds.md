# Refund operations (F07)

## Rollout

Apply migration `20260920010000_108_refund_intents` through the normal Prisma deployment process before deploying the API, web app and worker together. The migration adds a payment-order unique index and a tenant-scoped refund table; schedule it with the normal database backup and lock-impact review. Preserve the migration's forced RLS and narrow grants when applying baseline SQL. Do not expose this table through anonymous/authenticated Supabase roles.

The existing outbox worker now also runs the `payment-refunds` processor. A web/API-only deployment accepts requests but cannot send or reconcile them. Verify worker health and credentials for each tenant's original gateway. Refund submission deliberately refuses fallback to a different gateway or replacement gateway ID. Credential rotation must retain access to the same provider account.

Before production enablement, use provider **test mode** to verify a partial refund, pending-to-success callback, failure, worker restart after provider acceptance, and duplicate request. Confirm original payment ownership, exact amount/currency, one provider refund, one ledger record and the requested enrollment policy. This remediation did not run a live refund or apply the production migration.

## Operator meanings

| State                   | Meaning and next action                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| requested               | Saved and reserved; awaiting the worker's first submission.                                                                         |
| processing              | A worker holds a five-minute lease. Do not submit a replacement.                                                                    |
| pending                 | Provider acknowledged a refund that is not yet confirmed successful. Balance remains reserved.                                      |
| reconciliation_required | Outcome is unknown or mismatched. Balance remains reserved; investigate against the original provider payment.                      |
| succeeded               | Provider ownership, identity, amount and currency were verified; the ledger and requested enrollment revocation committed together. |
| failed                  | Provider explicitly confirmed failure. Reservation is released and enrollment is unchanged.                                         |
| manual_adjustment       | An operator recorded an externally handled adjustment with a reference. The LMS did not send money.                                 |
| legacy_recorded         | Historical ledger entry; no newly established provider confirmation. Its amount still consumes balance.                             |

An ordinary refund uses a permanent client request UUID. Repeat the same request identity and payload after a lost response. Changing the payload requires a new request identity and a fresh available-balance check. A separate HTTP idempotency cache is not the financial record of truth.

Manual adjustment is only for a separately verified external correction. Never use it as a second attempt for a pending/unknown gateway request. The UI does not request learner notifications; the API reports `notifyQueued: false` because a refund notification delivery workflow is not implemented.

## Reconciliation and incident recovery

Only an intent first claimed from `requested` can invoke the provider's refund endpoint. Submission uses `atlas-refund-<intent UUID>` as the stable provider idempotency key. Once claimed, a timeout, process crash, or database commit failure leads to read-only reconciliation after the lease expires. The worker never automatically repeats that money-moving call, including when no provider result is found. This prioritizes avoiding a duplicate financial action; a crash before submission can consequently require operator investigation.

Pending/unknown intents become due every five minutes. Signed callbacks only wake an existing intent for a fresh provider lookup. Callback metadata alone cannot change the ledger, set the provider refund ID, release balance, or revoke access. The lookup verifies the refund against the actual original Stripe PaymentIntent or Razorpay payment.

For an unknown result, inspect the intent, original payment, provider dashboard and provider logs using the request UUID/idempotency key. Read-only searches are bounded to 100 refunds; an older refund outside that window needs manual investigation. Restore the original gateway configuration if missing. Do not reset an intent to `requested`, delete it, change its amount, or issue a new manual/provider refund merely because the lookup returned nothing. A supervised correction requires independent evidence of the external outcome and an audited database change; there is no self-service reconciliation override in this release.

Monitor due/old requested intents, expired processing leases, aged pending/reconciliation-required intents and worker errors. Alert operators when age exceeds the agreed operational SLA. Reservations must remain in place until the external outcome is established. The general outbox delivery retry issue remains tracked separately as F08.

## Rollback

Pause refund intake and the refund worker first, and inspect all nonterminal intents and provider activity. Retain the table, permanent request identities and provider references. Do not roll back to the old synchronous refund code while requests remain unresolved: it cannot account for reservations and may issue another refund. Prefer a forward fix with intake paused. Do not delete financial history or drop the new table to resolve an incident.
