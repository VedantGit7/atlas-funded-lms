# F15 — Export storage and lifecycle

Implemented locally on 2026-09-20. Application-database rollout and a live R2 acceptance run remain pending. F08 had already added local file writes; this change addresses verification, bounded generation, download eligibility and physical cleanup.

## Result

- Tenant exports use the same streaming provider operations for R2, local filesystem and local mock storage. A job becomes successful only after stored size/content type and a full streamed SHA-256 readback match the generated file. ETags and echoed metadata are not treated as content verification.
- Generation reads 100 records per tenant-scoped keyset page into a private temporary file. Limits are 100,000 total records (or the tenant's smaller configured limit), 64 MiB total output, 64 KiB per database payload record and 120 seconds between page checks. Limits fail the job; no truncated success is published. Temporary files are removed after success/failure. Reads use separate short transactions, so the JSON explicitly describes its consistency as `paged_read_committed`, not an atomic snapshot.
- Storage identity, expected size/hash and a pending object reference are recorded before upload. Verification is recorded before success. The per-job key is deterministic; an uncertain R2 PUT is held for reconciliation instead of racing a retry against a potentially late write. Lost RUNNING jobs are not automatically stolen.
- Artifact retention uses tenant export settings (seven days by default). Each signed link has its own shorter lifetime, capped by remaining retention. Retention reductions shorten existing managed deadlines, including files that have not expired yet; the sweep also reconciles jobs finishing under an older setting. Both tenant-export download entry points reject expired, unverified, missing or mismatched artifacts. Local downloads stream instead of loading the whole file and use `private, no-store`.
- Report generation also uses file retention settings rather than the signed-link lifetime. Report download and delivery links respect artifact expiry. Historical report rows are not automatically deleted based on their old link-expiry values; the new `file_retention_managed` flag identifies new retention-managed reports. Explicit manual/policy cleanup remains available.
- Manual deletion, retention reduction and purge actions durably queue deletion and report that it is queued. The worker deletes and checks object absence outside database transactions. References are cleared only after confirmed deletion and a matching queue lease/source reference. Failures keep references and retry. Both reports and tenant exports preserve their original provider/bucket identity, so a configuration change cannot create false deletion confirmation. Cleanup includes inactive/deleted tenants. Database guards reserve retired keys and prevent source resurrection during cleanup.
- Cancelled tenant exports require a writer-stop acknowledgment before cleanup. A cancelled job with an uncertain remote upload remains for reconciliation. A successful job is already past all upload/readback operations.

## Verification and limits

Evidence is in `docs/engineering/audits/2026-09-20/f15-*.log`. Tests exercise actual local filesystem writes; actual AWS SDK serialization/signing against a controlled R2 HTTP fixture; corrupt/missing objects, limits, cancellation and retries; and disposable PostgreSQL schemas for pagination, migrations, tenant isolation, cleanup leases and key reservations. Type checks, scoped lint and broader regressions are recorded alongside those tests.

The R2 fixture is not a live Cloudflare account. This workspace has no configured R2 credentials, and no callable Cloudflare connector was available. A real configured bucket must pass the acceptance procedure before production closure. Prisma generation is local schema validation, not database migration. No application database was migrated and no customer files were deleted as part of verification.

This is not full personal-data portability: the F14 coverage manifest and exclusions remain. BI/report generation outside the tenant snapshot still has its existing materialization behavior; the bounded generation and SHA-256 success gate described here apply to tenant data-rights exports. Report retention/download/cleanup paths were updated because they share the cleanup lifecycle. Verification intentionally adds one complete object read; paging and disk spooling bound worker memory at the cost of temporary disk and storage-read I/O. External overwrites of a previously verified object are outside the application's immutable-key assumption; restrict bucket write access. Downloads check current size/type; the full checksum is verified at generation.

## Review and recorded checks

The independent review found two lifecycle gaps in the initial implementation: report cleanup needed a persisted provider/bucket identity, and reduced retention needed to shorten deadlines for files that were not expired yet. Both were addressed with regression coverage. Stream-source close and spool cleanup failures were also tightened.

The broad unit/CI run passed 2,459 tests; its only failure was a sandbox denial reading the existing package-manager cache. That CI guard passed when rerun with cache access (2,460 checks passed across the run and retry). Final targeted checks passed 198 storage/data-rights tests (four database-dependent cases skipped in that run), 362 report/sweep tests, and 10 isolated PostgreSQL tests across cleanup and pagination. The isolated database checks used disposable schemas, not application tables. Domain, API and frontend type checks, scoped lint, Prisma generation, and route/audit/outbox boundary guards passed. The independent reviewer rechecked both lifecycle fixes and reported no remaining blocker in those fixes.

## Rollout

Apply earlier pending migrations, then 112 (`artifact_json`) and 113 (cleanup queue, grants/RLS, key guards and report retention marker) before deploying the web/API/worker code together. Regenerate Prisma and run staging acceptance. Old tenant exports have no trusted manifest: regenerate them or reconcile their storage identity; do not mark old rows verified without reading and validating bytes.

See [export lifecycle runbook](../runbooks/export-lifecycle.md). F14's missing approved cross-domain retention policy remains open; these settings govern generated export files, not deletion of underlying learning/payment/proctoring records.

## Provider references

The implementation uses application-calculated readback hashes because [R2's S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/) varies by checksum mode and an [object ETag](https://developers.cloudflare.com/r2/objects/upload-objects/) is not a universal content hash. Cleanup checks the direct S3 endpoint under [R2 consistency guarantees](https://developers.cloudflare.com/r2/reference/consistency/), not a cached public URL.
