# Privacy lifecycle: access removal, exports and erasure review

This runbook documents the implemented boundary, not an approved retention schedule or a claim of legal compliance. The F14 inventory found no approved cross-domain schedule or executable legal-hold system. Existing settings and gaps are listed in [the data inventory](../engineering/f14-data-inventory.md).

## Supported operation

The existing membership-targeted deletion API is retained for compatibility. Its operation is **remove school access**. Processing changes the target school's membership status to REMOVED. It does not erase the member profile, learning/assessment records, billing, uploads, proctoring media, messages, analytics/search records, provider copies or backups. It does not delete the shared login or another school's membership. Owner-removal and existing authorization/MFA/idempotency rules remain in place.

The request is locked before processing. Access removal, the detailed outcome, completion status and audit evidence commit in the same tenant transaction. If any of those fail, the transaction rolls back. Concurrent processing of the same request returns the recorded result without repeating completion. Mutation retries using the legacy `{confirm:true}` request keep their original request fingerprint; an optional explicit operation can only be `remove_school_access`. A caller cannot request full erasure and silently get offboarding.

Migration 111 adds nullable `deletion_requests.outcome_json`. New successful operations record version 1, access removed, erasure not performed, global identity unchanged, retention review required, legal hold not assessed, and retained categories with reasons. A retention reason here explains what this operation left untouched; it is **not** an approval to retain it indefinitely. Historical outcomes remain NULL. Malformed/unknown evidence is not presented as verified erasure.

The administration UI can display the recorded result. After removing access, the learner may no longer be authorized to view school APIs. The administrator must provide the outcome through an approved, identity-verified contact process; no automatic delivery or successful delivery receipt is implemented by this change. Do not close a separate comprehensive erasure request merely because access removal succeeded.

## Export boundaries

- The learner download is a partial account/profile/preferences/plan snapshot assembled from existing self-service APIs. Its manifest distinguishes included/omitted sections. A failed section must not be silently replaced with fabricated empty data.
- The administrative export is a limited tenant snapshot: membership IDs/status/join dates; profile membership IDs/display names; non-deleted course ID/slug/title/status; enrollment ID/course/member/status. New artifacts include an explicit coverage manifest with field lists and exclusions. API responses expose known job scope and explicitly deny completeness as a personal-data export. Old unrecognized scope remains unknown.
- Neither is a complete subject-access export. Assessments, submissions, progress, certificates, payments, full profile fields, messages, uploads/proctoring, audit data, provider copies and backups require additional scope/authorization handling. Never route a learner request to a tenant-wide export to compensate for those omissions.

## Review workflow for broader erasure

1. Verify the requester and tenant scope using the approved support process. Determine whether the request concerns one school, multiple schools or the shared global login. Do not infer global deletion authority from tenant administration.
2. Inventory subject-linked rows, objects, free text/JSON snapshots and external identifiers across the categories in the F14 inventory. Include records linked by contact details rather than membership ID and derived search/analytics projections.
3. Obtain the applicable approved category policy, purpose, retention trigger/period, retention decision authority and any hold decision. Record a reason and review/expiry date for each retained category. The current application does not implement holds; existing automatic purges do not check them. Do not promise that a hold is technically enforced until this is implemented and tested.
4. For each approved deletion/anonymization, define tenant-bounded execution, dependency order, resumable retries, failures, verification and external deletion receipts. Shared records and other tenants require separate authorization. Preserve audit evidence with appropriate minimization; do not remove evidence simply to make the request look complete.
5. Verify provider processing independently. Database cleanup cannot retract delivered emails, webhook payloads, downloaded exports or gateway records. Check R2/local object existence, CDN/public copies and provider retention/export/deletion support.
6. Verify production backup/PITR expiry and access. Plan how completed privacy operations will be reapplied before reopening a restored database. An expired link or local restore drill does not prove a backup record has been erased.
7. Send an accurate outcome: completed operations, retained categories/reasons/review dates, pending failures/provider actions and backup scope. Preserve delivery evidence through the approved process. Keep unresolved items open; do not label the entire request erased if only access was removed.

## Deployment and rollback

Apply migration `20260920030000_111_privacy_outcomes` through the normal reviewed migration process **before** deploying the new API. It changes an existing tenant-isolated table and preserves existing RLS/grants. No production or development application database migration was executed during F14 verification. The isolated test applies it only to disposable tables in the local maintenance database.

Deploy compatible API/UI together. Verify an old idempotency retry, a new access-removal request, retained outcome display, a legacy success row, both partial exports and owner/cross-tenant denial. Verify from another school that the same user's membership/login remains valid. Code rollback can leave the nullable column intact; do not drop the evidence column or erase recorded outcomes as a rollback step.

The regression suite covers scope, outcomes, cached response compatibility and local SQL atomicity/concurrency. Hosted authenticated journeys, production policies/grants, provider deletion and backup expiry still require acceptance. A migration or test result alone does not close the full F14 privacy-lifecycle finding.
