# Export lifecycle operations

## Normal behavior

Tenant exports move QUEUED → RUNNING → SUCCEEDED only after streaming upload and readback verification. The job stores its provider/bucket, byte count, SHA-256 and verification timestamp in `artifact_json`. `expires_at` is file retention; it is not the lifetime of a previously issued URL. A fresh URL expires no later than the file's retention deadline.

Generation is capped at 100,000 records, 64 MiB, 64 KiB per projected row, and a 120-second page-loop budget. A smaller tenant row limit is respected. `EXPORT_*_LIMIT` failures need a smaller supported export or an explicitly designed larger-export pipeline; retrying unchanged data does not solve them. Pages are not a point-in-time database snapshot.

Manual removal and expiry queue work in `export_file_cleanup_requests`. The worker claims at most 50 per tenant/pass, uses five-minute leases and delays failed requests for one minute. A file disappears from its source reference only after object deletion and HEAD-confirmed absence. Queue rows remain as key reservations. Monitor pending age, attempts and `last_error`, plus sweep errors. Failed storage operations must never be “fixed” by nulling file references.

Already issued signed links may remain usable until expiry or physical deletion. Removing a file does not erase underlying source records or copies a recipient already downloaded.

## Reconciliation

- Legacy tenant export without a manifest: regenerate it for downloading. For cleanup, locate and verify the original provider/bucket/key under that tenant before creating trusted cleanup metadata; do not guess after storage configuration changes.
- `EXPORT_UPLOAD_OUTCOME_UNKNOWN`, a stranded RUNNING job, or CANCELLED without `writerStoppedAt`: verify the previous worker and any remote upload have stopped before changing state. Inspect the recorded key at the recorded bucket. Validate all bytes against the pending size/hash before accepting an artifact. Otherwise queue removal only after the writer is confirmed stopped, then request a new export. Do not reuse retired keys.
- Changed provider/bucket: restore access to the recorded location for cleanup or perform an explicit reconciled migration; the worker fails closed instead of deleting from a guessed location.
- Storage deletion/HEAD failure: restore storage access and let the queued retry complete. Keep the pointer and audit trail.
- Legacy reports have `file_retention_managed=false`; automated expiry deliberately leaves them alone because old `expires_at` values represented short link lifetimes. Review actual retention requirements and use the explicit purge/manual flow when appropriate.

## Staging acceptance

1. Apply pending migrations through 113 to isolated staging; deploy API, web and worker versions together. Verify tenant RLS and worker privileges for the cleanup queue.
2. Configure local filesystem storage in development, generate a known fixture export, download through the signed local route, and compare JSON coverage, bytes and SHA-256. Confirm a refreshed short link works during the file's retention period.
3. Repeat using a dedicated live R2 staging bucket and scoped credentials. Verify direct HEAD, downloaded SHA-256 and absence of unsupported streaming checksum trailers. Local fixture tests do not replace this step.
4. Interrupt uploads and deny storage reads/writes. No affected job may expose a download URL. Unknown remote writes must require reconciliation.
5. Exercise an expired file, cancelled writer, manual removal, retention reduction and storage outage during cleanup. The UI must say queued; failures retain references; restored storage permits confirmed deletion. Include an inactive tenant.
6. Confirm legacy artifacts are held as described and no unrelated source records are removed. Run regression checks and preserve evidence before enabling production cleanup.
