-- Queue rows are retained as deletion receipts and retired-key reservations.
REVOKE ALL ON export_file_cleanup_requests FROM PUBLIC, atlas_platform, atlas_app, atlas_worker;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON export_file_cleanup_requests FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON export_file_cleanup_requests FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON export_file_cleanup_requests TO atlas_app, atlas_worker;
