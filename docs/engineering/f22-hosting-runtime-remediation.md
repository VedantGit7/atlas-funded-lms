# F22 — Hosting, durable metering and background processing

Implemented and applied to the local LMS database on 2026-09-21. Production acceptance remains pending deployment and live provider verification.

## Changes

### Usage survives request-process shutdown

Request and email metering now await a PostgreSQL journal append. The production timer and in-memory counter backlog have been removed. A stable event UUID is reused across two bounded attempts, preventing duplicate rows when a connection fails after commit. The worker aggregates pending records and marks them processed in the same tenant transaction; a failed transaction rolls back both changes. Concurrent workers use row locks with `SKIP LOCKED`. Processed IDs remain for 30 days; pending entries are never removed by that retention rule.

A separate pool avoids competing with a business transaction that is already holding a database connection while sending email. It defaults to two connections, has a 500 ms acquisition limit and a 1.5 second transaction deadline. Deadline expiry destroys the connection and awaits query failure. With two attempts, a database outage can add approximately four seconds before metering gives up and logs a redacted failure. Operational attribution can still undercount writes that never commit; it is not an exactly-once billing system. Customer billing remains on its existing transactional ledger.

The F17 connection budget and optional pool telemetry now include this additional pool. The illustrative budget is 106 connections including reserves; operators must supply their actual database limit and replica counts, not treat the example as purchased capacity.

### Large uploads and SCORM processing

Remote lesson and SCORM uploads send the browser `File` directly to the signed object URL without first copying it into an application buffer. Local blob endpoints reject deployed environments and remote-storage configurations before reading bulk data. Production web proxy buffering is reduced to 4 MB and Server Actions to 1 MB. Development retains a bounded local-storage upload path for the existing local LMS.

SCORM confirmation now commits a durable processing event rather than downloading and extracting the ZIP within the request transaction. A worker processes one archive per invocation. Limits are 100 MiB compressed input, 25 MiB per expanded entry, 250 MiB total expanded content, 2,000 archive entries and a four-minute storage-processing deadline. Central-directory names are limited to 1,024 UTF-8 bytes and 32 path segments before the library builds its entry index. Classic single-disk ZIP is supported; ZIP64 metadata is rejected. The compressed archive remains in memory; expanded files are published sequentially. This bounds the working set but is not a fully streaming ZIP parser or a measured peak-RSS guarantee.

Each attempt writes to its own random content prefix. Publication locks the delivery claim and module, then validates the current asset, attempt and wall-clock lease expiry. A stale worker cannot overwrite the winning version, including after waiting for another transaction. Existing packages retain their legacy paths until replaced. Invalid packages reach the existing failure/retry handling, and learners cannot launch an unready package.

### Explicit worker runtime

The selected architecture remains Vercel web plus a separately hosted managed Node API and continuously running worker. Deployed API and worker startup require `ATLAS_SERVICE_RUNTIME=managed-node` and reject known function/edge environments. This is an enforceable configuration contract, not discovery or provisioning of a host.

Production certificate PDFs and exports are owned by durable workers. Request completion callbacks no longer launch this heavy work in production. Sweeps are serial, ordinary batches are capped at 100, and heavy artifact processors claim one job per tenant per pass. Usage draining includes inactive tenants. Shutdown stops starting additional units and permits in-flight work to finish within the configured grace period. Existing privacy-export reconciliation rules continue to preserve uncertain remote outcomes instead of replaying them blindly.

Docker API/worker targets, a constrained Compose reference and a [managed runtime runbook](../runbooks/managed-node-runtime.md) document build, health, restart and rollout requirements. Local `pnpm dev` now starts the worker alongside web and API. API and worker hosts have not been provisioned.

## Verification and local rollout

- A fresh PostgreSQL 17 database was provisioned with all 117 migrations and 146 catalogue records.
- Ten database tests passed across durable usage, SCORM recovery and cost attribution. They prove journal retention after a producer exits without cleanup, duplicate replay protection, atomic rollback, concurrent drains, tenant isolation, persistence while the business pool is full, interrupted SCORM claim recovery and rejection of stale publication.
- The direct-upload test sent a real 6 MiB HTTP body to a disposable local object endpoint and checked its byte count and SHA-256 digest. This proves the client transport; it does not establish live R2 signing, CORS or deployed routing.
- 242 focused tests passed across 20 metering, upload/parser, worker, deployment, certificate, privacy-recovery and pool-budget/instrumentation suites. The standalone telemetry test also passed. Parser regressions include forged STORED sizes, ZIP64 directory-count overrides and excessive path metadata. Three database race regressions first reproduced stale publication, then passed with the locking fix.
- Full-project TypeScript checking, Prisma validation/client generation, targeted lint, SQL placement and worker registration checks passed. A broad Prisma-boundary scan was inconclusive. Full application CI and the API production image build were not run.
- The final Linux worker image built successfully. An offline smoke run used an unprivileged account, a read-only filesystem, 2 GiB memory and 2 CPUs; all 12 processors imported and Chromium produced a 9,052-byte PDF. Local environment/test/provider state files were absent. The actual startup command reached deployment validation and correctly rejected missing Redis configuration. Dependency installation, Prisma generation and Chromium layers were reused after source-only changes. [Image evidence and digests](audits/2026-09-21/f22-worker-image.json). This validates the worker package, not a configured production deployment or maximum-load memory use.
- Migrations `116_durable_usage_events` and `117_scorm_processing` were applied individually to `localhost:15432/atlas_lms_dev` and registered as applied. The journal has enabled and forced row-level security, and the nullable SCORM content-version column is installed. Earlier pending migrations were not deployed as part of this change. [Local evidence](audits/2026-09-21/f22-local-after.json).

The disposable database test fixtures were cleaned by the F20 ownership guard and its container was stopped. The existing local LMS database and development ports remain available. Restart local development with `pnpm dev` to include the worker in the running process group.

## Remaining release gates and efficiency work

1. Select and configure the managed API/worker host, inject validated staging settings and deploy immutable images. Apply migrations before the new application code; deploy the worker before enabling traffic that produces these jobs. Verify restart and shutdown on that actual host.
2. Configure private R2 storage and origin-specific CORS. From the deployed web origin, upload a disposable file above 4.5 MB, confirm/process it and retrieve it through a fresh instance. Verify expired signatures, rejected origins and tenant authorization. SCORM content delivery through the web's external API rewrite also needs live large-response verification; local tests do not prove its hosting behavior.
3. Measure memory and elapsed time with representative maximum-size SCORM/PDF/export jobs under the reference 2 GiB worker limit. A four-minute timeout cannot preempt synchronous JavaScript decompression; the input limits and host memory/CPU limits remain necessary.
4. Monitor `usage_meter.persistence_failed`, journal age, delivery backlog, retries/dead letters, worker health and the extra pool's saturation. Alerting and retention must be configured in the actual monitoring provider. A stopped worker delays rollups and package readiness while the database retains the work.
5. Add a reference-aware cleanup process for abandoned or superseded SCORM generation prefixes. Failed/replaced attempts can leave private objects; never apply a blanket age-based delete to the content prefix because a currently published package may be old. Until cleanup exists, include these objects in storage-cost review.
6. Rerun the F17 load/soak measurements with the new awaited metering path and actual instance/pool sizes. The dedicated pool removes a deadlock risk but each event adds a database transaction; production sizing requires measured queue lag, write latency and connection demand.

No production service, paid hosting, live R2 bucket or customer data was changed. F22 is locally implemented; it should remain conditional in the production release checklist until the host/provider gates pass.
