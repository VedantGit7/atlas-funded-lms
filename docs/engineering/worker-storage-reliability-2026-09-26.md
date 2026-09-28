# Worker and storage reliability drills — 2026-09-26

Local operational evidence is stronger; hosted acceptance remains open. These drills used Node 24.21.0 on Windows, a newly provisioned PostgreSQL 17 fixture at loopback port 15445, and temporary filesystem objects. No application environment file, existing development database, provider bucket, paid resource, or customer data was used. No production implementation changed.

## Observed results

| Drill                         | Result                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maximum default upload        | A valid ZIP of exactly **100,000,000 bytes** passed through the production browser upload helper to a real loopback HTTP receiver. Received length and SHA-256 matched. Transfer took **830 ms**. Signing and confirmation were test substitutes; the bytes bypassed those API calls.                                                          |
| SCORM interrupted publication | An actual child process was forcibly terminated after writing its first extracted file. A fresh child invoked the production bounded publisher and filesystem provider under a distinct attempt prefix, published all six files, and checked each stored digest. The old attempt's file remained present.                                      |
| SCORM resource measurement    | The fresh successful publisher took **1,132 ms**, including rereading output for digest verification. Process peak resident memory was **239,194,112 bytes (about 228 MiB)**. The test harness peaked at **644,325,376 bytes** while constructing ZIP and File fixtures; that is a separate process and workload.                              |
| Usage drain abrupt exit       | Seven committed journal events were drained by a child, which was killed before its tenant transaction committed. A separate connection saw seven pending events and no request rollup. A fresh child counted exactly seven requests and 175 ms; a second fresh child processed zero. The other tenant's event remained pending.               |
| Cleanup provider failure      | An injected delete failure left the actual file and its database reference intact and recorded retryable work.                                                                                                                                                                                                                                 |
| Cleanup crash after deletion  | A child deleted the actual file and confirmed absence, then was forcibly terminated before database acknowledgement. The source reference remained. After advancing only that fixture's lease expiry, a fresh child repeated idempotent deletion and acknowledged absence on attempt three. The source key and artifact manifest were cleared. |
| Cleanup preservation          | A running export belonging to the same tenant and an expired export belonging to a different tenant retained their file bytes and database references. No retention duration or eligibility rule changed.                                                                                                                                      |

The three new drills passed together. Nine existing focused suites also passed **50 tests**, covering SCORM claim recovery and stale-publication fencing, durable usage transactions/concurrency, export cleanup SQL and tenant boundaries, bounded archives, direct upload, and worker lifecycle.

The F20 ownership guard removed the synthetic database fixtures after each run. A final read verified zero tenants and zero authentication principals in the disposable worker database. Temporary filesystem roots were removed after verification, including the deliberately retained orphan fixture. The orphan's removal was test-fixture teardown, not application cleanup.

## Limits and remaining acceptance

- The full deployed worker supervisor, container restart policy, host shutdown behavior, and live R2 signing/CORS/routing were not exercised. Child processes called the production work units directly. The existing main-loop lifecycle test uses substituted sweeps and emitted signals.
- Memory was measured by `process.resourceUsage().maxRSS` on this Windows machine. The publisher stayed below the 2 GiB reference budget, but this was not a container-enforced limit, concurrency/soak test, CPU-throttled host, or maximum expanded 250 MiB archive. ZIP payloads used valid STORED entries. Hosted SCORM/PDF/export sizing remains necessary.
- Cleanup retry deadlines were advanced in synthetic rows to avoid waiting for the normal lease. Claim/acknowledgement logic and real process termination were exercised; wall-clock backoff duration was not.
- **Abandoned and superseded SCORM generation cleanup remains missing.** This drill confirms that interrupted objects remain. Do not apply a blanket age rule to SCORM content: currently published old packages must remain available. Reference-aware cleanup requires its own approved design and implementation.
- No new end-to-end production claim follows from these local drills.

## Repeat the drills

The new tests are opt-in with `ATLAS_RELIABILITY_DRILL=1`; ordinary suites skip their large payload and process-loss work. Use the repository's Node 24 runtime and package manager.

For the database drill, first provision an empty disposable `atlas_lms_test`, apply migrations/catalogues, initialize `scripts/db/initialize-test-cleanup.mjs`, and supply explicit `DATABASE_URL`, `PLATFORM_DATABASE_URL`, separate `TEST_CLEANUP_DATABASE_URL`, `TEST_DATABASE_ID`, and `ALLOW_DESTRUCTIVE_TEST_CLEANUP=1`. The existing global setup validates database identity and records fixture ownership. Never source normal application environment files for this run.

```powershell
$env:ATLAS_RELIABILITY_DRILL = '1'
pnpm exec vitest run tests/unit/storage/worker-storage-large-upload.test.ts tests/integration/api/worker-storage-recovery.postgres.test.ts --maxWorkers=1
```

Machine-readable evidence and logs are in [the audit directory](audits/2026-09-26/worker-storage/). Runtime evidence is regenerated beneath `.test-results/reliability/`. The disposable fixture credential file is ignored and must not be copied into release evidence.
