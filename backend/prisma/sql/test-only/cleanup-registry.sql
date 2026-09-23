-- Explicit disposable-test bootstrap only. Never part of application provisioning.
CREATE SCHEMA IF NOT EXISTS atlas_test_cleanup;
REVOKE ALL ON SCHEMA atlas_test_cleanup FROM PUBLIC;
CREATE TABLE IF NOT EXISTS atlas_test_cleanup.database_identity (
  singleton boolean PRIMARY KEY CHECK (singleton),
  database_id uuid NOT NULL,
  database_name text NOT NULL,
  purpose text NOT NULL CHECK (purpose = 'disposable-tests-only')
);
CREATE TABLE IF NOT EXISTS atlas_test_cleanup.runs (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cleaned')),
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS atlas_test_cleanup.owned_rows (
  entity_kind text NOT NULL CHECK (entity_kind IN ('tenant','principal')),
  entity_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES atlas_test_cleanup.runs(id),
  PRIMARY KEY(entity_kind,entity_id)
);
CREATE INDEX IF NOT EXISTS owned_rows_run_idx ON atlas_test_cleanup.owned_rows(run_id);
CREATE OR REPLACE FUNCTION atlas_test_cleanup.capture_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE run uuid := NULLIF(current_setting('atlas.test_run_id',true),'')::uuid;
BEGIN
  -- A UUID may have belonged to a deleted fixture. Attribute this insertion,
  -- including an untracked insertion, rather than inheriting that old owner.
  DELETE FROM atlas_test_cleanup.owned_rows
    WHERE entity_kind=TG_ARGV[0] AND entity_id=NEW.id;
  IF run IS NULL THEN RETURN NEW; END IF;
  PERFORM 1 FROM atlas_test_cleanup.runs WHERE id=run AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Test fixture run is missing or no longer active'; END IF;
  INSERT INTO atlas_test_cleanup.owned_rows(entity_kind,entity_id,run_id)
    VALUES(TG_ARGV[0],NEW.id,run);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION atlas_test_cleanup.capture_insert() FROM PUBLIC;
CREATE OR REPLACE FUNCTION atlas_test_cleanup.maintain_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM atlas_test_cleanup.owned_rows
      WHERE entity_kind=TG_ARGV[0] AND entity_id=OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    IF EXISTS (SELECT 1 FROM atlas_test_cleanup.owned_rows
      WHERE entity_kind=TG_ARGV[0] AND entity_id=OLD.id) THEN
      RAISE EXCEPTION 'Cannot change the ID of a tracked test fixture';
    END IF;
    -- An untracked row moved onto a previously used UUID remains untracked.
    DELETE FROM atlas_test_cleanup.owned_rows
      WHERE entity_kind=TG_ARGV[0] AND entity_id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION atlas_test_cleanup.maintain_identity() FROM PUBLIC;
DROP TRIGGER IF EXISTS atlas_test_capture_tenant ON public.tenants;
CREATE TRIGGER atlas_test_capture_tenant AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION atlas_test_cleanup.capture_insert('tenant');
DROP TRIGGER IF EXISTS atlas_test_capture_principal ON public.auth_principals;
CREATE TRIGGER atlas_test_capture_principal AFTER INSERT ON public.auth_principals
  FOR EACH ROW EXECUTE FUNCTION atlas_test_cleanup.capture_insert('principal');
DROP TRIGGER IF EXISTS atlas_test_maintain_tenant ON public.tenants;
CREATE TRIGGER atlas_test_maintain_tenant BEFORE UPDATE OF id OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION atlas_test_cleanup.maintain_identity('tenant');
DROP TRIGGER IF EXISTS atlas_test_maintain_principal ON public.auth_principals;
CREATE TRIGGER atlas_test_maintain_principal BEFORE UPDATE OF id OR DELETE ON public.auth_principals
  FOR EACH ROW EXECUTE FUNCTION atlas_test_cleanup.maintain_identity('principal');
GRANT USAGE ON SCHEMA public,atlas_test_cleanup TO atlas_test_cleanup;
GRANT SELECT,DELETE ON ALL TABLES IN SCHEMA public TO atlas_test_cleanup;
-- Row locking requires UPDATE on at least one column; no broad update grant.
GRANT UPDATE(id) ON public.tenants TO atlas_test_cleanup;
GRANT UPDATE(id) ON public.auth_principals TO atlas_test_cleanup;
GRANT SELECT ON atlas_test_cleanup.database_identity TO atlas_test_cleanup;
GRANT SELECT,INSERT,UPDATE ON atlas_test_cleanup.runs TO atlas_test_cleanup;
GRANT SELECT,DELETE ON atlas_test_cleanup.owned_rows TO atlas_test_cleanup;
GRANT SET ON PARAMETER session_replication_role TO atlas_test_cleanup;
