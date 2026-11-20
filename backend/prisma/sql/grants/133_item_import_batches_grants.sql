-- Question imports (migration 133).
--
-- The blanket GRANT in 025_02_table_grants.sql runs after the migrations on
-- every provision and release and hands every role full access to every
-- table. This file runs after it and narrows this one again.
--
-- A batch is the history of an upload: the app opens it, fills in its counts
-- and closes it (completed, or undone in PR 4), and never deletes it. Nothing
-- else writes it.
REVOKE ALL ON item_import_batches FROM PUBLIC, atlas_app, atlas_worker, atlas_platform;
GRANT SELECT, INSERT, UPDATE ON item_import_batches TO atlas_app;
GRANT SELECT ON item_import_batches TO atlas_worker, atlas_platform;
