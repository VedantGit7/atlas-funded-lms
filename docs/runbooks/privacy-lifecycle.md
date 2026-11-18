# Privacy lifecycle: erasure, exports and backups

Since launch plan 5.7 (November 2026) a deletion request erases the member's personal data in one academy. The design, the per-category decisions and the append-only and audit-chain handling are in [member-erasure.md](../engineering/member-erasure.md); the earlier access-removal boundary and its gaps are in [the F14 data inventory](../engineering/f14-data-inventory.md).

## How a request is carried out

1. **Request.** The learner (Profile → Danger zone) or an admin with `data.deletion.request` files it. It is `QUEUED` with `scheduled_at` 7 days ahead, inside the 30 days the Privacy Policy promises.
2. **Processing early.** An admin with `data.deletion.manage` may process it; that sets `scheduled_at` to now. Nothing is erased by the API itself.
3. **Erasure.** The worker task `member-erasure` finds due requests each sweep (all academies, active or not) and calls `app.erase_member()`, which erases the database records in one transaction, logs the erasure in `member_erasures` and sets the request `RUNNING`. The worker then deletes the stored files (avatars, exam monitoring media), deletes the login account through `app.erase_member_account()` if no other academy uses it and it isn't a platform operator, and records the version 2 outcome through `app.complete_member_erasure()`, which sets the request `SUCCEEDED`.
4. **Refusals.** The academy owner can't be erased (ownership moves first). The request becomes `FAILED` with `error: ACADEMY_OWNER`.
5. **Partial failure.** A failure after the database transaction leaves the request `RUNNING`; the next sweep resumes and only repeats what is left. Files that still won't delete stay in `member_erasures.pending_objects` and the request stays `RUNNING`; check `worker.sweep.processor_failed` for `member-erasure`.

What is kept, by the owner's decision: certificates, payment records, agreement records, community content (as "Deleted member") and audit entries (payloads redacted). Outside the database's reach, and stated in each outcome: copies with providers (delivered emails and webhooks, Sentry, PostHog, the payment processor), backups until they expire, and exports already downloaded.

## After a restore

Backups are kept 14 days. A restore from before an erasure brings the erased data back. Before reopening a restored database, re-erase every member in `member_erasures` whose `completed_at` is after the backup was taken:

1. For each such row, find its deletion request (`deletion_request_id`), set it back to `QUEUED` with `scheduled_at = now()`, and remove the restored `member_erasures` row if the backup contains it.
2. Let the worker run, or run its sweep once, and check every request is `SUCCEEDED` again.

The erasure log itself must survive the restore: take the list of erasures from the live database before restoring over it.

## Export boundaries

- The learner download is a partial account/profile/preferences/plan snapshot assembled from existing self-service APIs. Its manifest distinguishes included/omitted sections. A failed section must not be silently replaced with fabricated empty data.
- The administrative export is a limited tenant snapshot: membership IDs/status/join dates; profile membership IDs/display names; non-deleted course ID/slug/title/status; enrollment ID/course/member/status. New artifacts include an explicit coverage manifest with field lists and exclusions. API responses expose known job scope and explicitly deny completeness as a personal-data export. Old unrecognized scope remains unknown.
- Neither is a complete subject-access export. Assessments, submissions, progress, certificates, payments, full profile fields, messages, uploads/proctoring, audit data, provider copies and backups require additional scope/authorization handling. Never route a learner request to a tenant-wide export to compensate for those omissions.

## Requests outside the application

A request by email to the Grievance Officer is filed as a deletion request by an admin, after confirming the requester's identity, so it follows the same path. Requests that span academies are one request per academy; the login account goes with the last one.

## Deployment and rollback

### Current retention operations and monitoring

F15 export-file cleanup queues storage deletion, preserves the original provider/bucket identity, and clears references only after confirmed object absence. It includes inactive/deleted tenants; F22 usage draining also includes them. Tenant replay, proctoring-media and attribution purge tasks still run only for active, non-deleted tenants. Do not extend their destructive scope on the assumption that an existing software default is an approved policy. Run-record metadata retention settings still have no age-based deletion job.

Proctoring deletion failures are exposed as `worker.sweep.processor_failed` for `proctoring-media-purge`. Successful row deletions commit before a partial failure is reported; failed objects retain their rows for retry, and the sweep continues with other tasks. Partial batches are omitted from the successful-purge counter, so use it as a progress indicator, not as a complete deletion receipt. Configure and verify alerts on the deployed worker; local tests do not prove provider monitoring.

Proctoring cleanup currently uses the configured storage provider/bucket rather than a persisted original location and does not check object absence after deletion. Before relying on media cleanup across a storage configuration change, reconcile original locations and implement verified cleanup. Do not discard references or mark media erased on the strength of a successful request to a different/unknown storage location.

There is still no enforced hold registry or fail-closed hold lookup covering all purge entry points. Record the hold authority, scope, review/release rules and affected data domains before implementing it. A prospective hold must also account for manual cleanup and existing queued work. Unknown hold status or a failed lookup must block the relevant destructive action in that future design; an unused callback alone is not a control.

### Original F14 rollout procedure

Apply migration `20260920030000_111_privacy_outcomes` through the normal reviewed migration process **before** deploying the new API. It changes an existing tenant-isolated table and preserves existing RLS/grants. No production or development application database migration was executed during F14 verification. The isolated test applies it only to disposable tables in the local maintenance database.

Deploy compatible API/UI together. Verify an old idempotency retry, a new access-removal request, retained outcome display, a legacy success row, both partial exports and owner/cross-tenant denial. Verify from another school that the same user's membership/login remains valid. Code rollback can leave the nullable column intact; do not drop the evidence column or erase recorded outcomes as a rollback step.

The regression suite covers scope, outcomes, cached response compatibility and local SQL atomicity/concurrency. Hosted authenticated journeys, production policies/grants, provider deletion and backup expiry still require acceptance. A migration or test result alone does not close the full F14 privacy-lifecycle finding.
