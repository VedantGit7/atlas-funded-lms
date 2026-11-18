-- Member erasure (migration 132, docs/engineering/member-erasure.md).
--
-- The blanket GRANT in 025_02_table_grants.sql runs after the migrations on
-- every provision and release and hands every role full access to every
-- table. This file runs after it and narrows these again.

-- The erasure log opens the door on append-only tables, so only the erasure
-- functions (owned by atlas_platform) may write it. Nobody deletes it: it is
-- the record a restored backup is re-erased from.
REVOKE ALL ON member_erasures FROM PUBLIC, atlas_app, atlas_worker, atlas_platform;
GRANT SELECT ON member_erasures TO atlas_app, atlas_worker;
GRANT SELECT, INSERT, UPDATE ON member_erasures TO atlas_platform;

-- Original payload hashes of redacted audit entries; written by the
-- append-only trigger during an erasure, which runs as atlas_platform.
REVOKE ALL ON audit_entry_redactions FROM PUBLIC, atlas_app, atlas_worker, atlas_platform;
GRANT SELECT ON audit_entry_redactions TO atlas_app, atlas_worker;
GRANT SELECT, INSERT ON audit_entry_redactions TO atlas_platform;

-- 025_02 revokes DELETE on these append-only monitoring events from every
-- role. The erasure deletes a member's own events; the append-only trigger
-- still refuses any delete outside an open erasure.
GRANT DELETE ON proctoring_events TO atlas_platform;

-- Agreement records are evidence: added, never changed or removed (launch
-- plan 5.7, migration 131). Kept through an erasure.
REVOKE UPDATE, DELETE ON tenant_legal_acceptances FROM atlas_app, atlas_worker, atlas_platform;
