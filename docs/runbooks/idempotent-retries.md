# Idempotent retries after F03

## Client contract

Use one random `Idempotency-Key` per intended mutation, between 1 and 256 UTF-8 bytes. Retry with the same authenticated actor, endpoint, and validated input. Tenant keys remain unique within a tenant; platform keys are unique across the platform. Reusing a key for another actor, operation, or payload produces 422 without returning the cached response or executing another mutation.

Every tenant retry must still satisfy active membership, the route's current entitlement, resource authorization, and MFA requirements. Platform retries require the current database operator grant, requested permission, reason, and session MFA. Retries do not consume another entitlement unit or repeat the handler. Request observability and platform-scope audit entries still record each attempt.

If authorization has changed, or a resource was removed, a previously successful mutation can now receive a denial or a not-found response. Do not interpret that as proof that the original mutation failed. Restore legitimate access or reconcile through an authorized read workflow.

The replay window is 24 hours, with a maximum cached response size of 256 KiB. Expired, incomplete, or oversized cached results produce 409 instead of re-execution. A disappearing claim also produces 409. Investigate the original outcome before issuing a new key. Once retention removes a record, the registry cannot recognize its key; this is a bounded retry guarantee, not permanent deduplication.

Database writes and claims commit together. A rollback removes both. This cannot roll back an external payment, email, or storage API call: handlers still need provider idempotency keys or transactional outbox delivery for those effects. F07/F08 remain separate work.

## Rollout

1. Apply Prisma migration `20260919120000_107_platform_idempotency` before starting the new platform wrapper. It creates a separate platform table, enables and forces RLS, and denies tenant/worker access. The grants bootstrap file repeats these restrictions after its broad grants.
2. Deploy the code to all instances together. An older instance still contains the original replay weaknesses. Do not roll back F01/F02 when deploying F03.
3. Verify identical authorized retries execute once; changed actors/payloads are denied; revoked permissions, entitlement, membership, and session MFA deny cached access.
4. Existing tenant records with a matching actor and fingerprint remain compatible. Legacy tenant records without actor identity are rejected. Legacy provisioning jobs cannot establish actor/payload identity and return a conflict. Provisioning with an already-used slug also returns a conflict; inspect the existing tenant rather than submitting another creation request.
5. Provisioning retries created after deployment are served from the platform registry. Older platform mutations other than provisioning had no registry, so their outcomes cannot be reconstructed automatically. Reconcile uncertain pre-deployment operations before retrying them.

Migration 107 was applied and verified on `localhost:15432/atlas_lms_dev` on 19 September 2026. No production deployment or production migration was performed. The local platform console was reloaded successfully with the existing operator session afterward.

## Retention operations

The existing tenant outbox sweep calls `purgeExpiredIdempotencyRecords`; it now removes only completed expired records. That worker visits active tenants only, so expired records for inactive tenants need approved maintenance as part of tenant lifecycle operations.

The platform table is deliberately inaccessible to that tenant worker. Before production rollout, assign an owner and schedule a daily maintenance job for completed platform records. This patch does **not** install that scheduler. Use the correct maintenance connection and retain its execution record. A bounded batch is:

```sql
BEGIN;
SET LOCAL ROLE atlas_platform;
SELECT set_config('app.platform_scope', 'true', true);
DELETE FROM platform_idempotency_records
WHERE id IN (
  SELECT id FROM platform_idempotency_records
  WHERE status = 'COMPLETED' AND expires_at < now()
  ORDER BY expires_at
  LIMIT 1000
  FOR UPDATE SKIP LOCKED
);
COMMIT;
```

Repeat batches until no rows are deleted; record counts and duration. Monitor the oldest completed expired row and alert when it exceeds the agreed cleanup delay. Investigate persistent `IN_PROGRESS` records instead of deleting them automatically. Expiration prevents replay even if maintenance is delayed, but stored response data remains until cleanup.

## Isolated verification

`tests/integration/api/idempotency-security.postgres.test.ts` accepts only a local maintenance connection through `F03_TEST_DATABASE_URL`. It creates a uniquely named `f03_test_*` schema, applies the registry migrations there, checks transactional concurrency/rollback and platform privileges, then removes only that schema. Keep ordinary `DATABASE_URL` and related test database variables unset so the project's broad global teardown cannot purge development tenants. This check does not exercise live customer workflows or external side effects.
