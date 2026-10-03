# Operational reliability verification

Requested: prove backup/restoration, rollback, alerts, large uploads, worker restart and cleanup behavior; resolve migration-verification gaps. Preserve existing uncommitted security work. Never treat local evidence as hosted acceptance.

1. Inventory existing resources and verification scripts. Reproduce verifier false positives before fixing them. Record local versus deployed scope explicitly.
2. Provision a dedicated loopback PostgreSQL 17 fixture from all current migrations and SQL phases. Keep an idle source for restore and catalog reference; use a separate cloned database for worker tests. Do not alter the development database or its migration ledger.
3. Harden the restore drill: explicit safe identities, unique new target, no preexisting-target deletion, strict restore errors, comprehensive schema/row checks, ownership-checked cleanup and truthful timing. Run successful restoration plus negative boundary/error tests on disposable data.
4. Classify historical migration checksums using fresh ledger reads and available Git history. Compare relevant catalog effects with clean replay. Missing original bytes remain provenance gaps; never rewrite history to manufacture a match.
5. Exercise bounded real upload/publish and child-process interruption/recovery with synthetic objects and tenant-owned test records. Verify durable retry, digest, cleanup absence and preserved active/foreign references. Record unfinished SCORM generation cleanup separately.
6. Harden rollback/restore-health verification and run local release-switch/failure/recovery/heartbeat checks. Bind observations to exact release identity. Do not send messages to alert recipients or roll back real deployments without explicit authorization.
7. Review changes independently, run focused and combined checks appropriate to changes, stop only owned test resources, and publish a dated report with evidence and remaining hosted requirements. Do not purchase hosting/storage or claim RPO, production RTO, alert receipt, full image rollback or provider cleanup from synthetic fixtures.
