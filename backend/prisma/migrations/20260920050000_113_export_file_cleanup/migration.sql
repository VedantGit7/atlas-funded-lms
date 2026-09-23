-- Durable retention/manual deletion requests. Object references are only cleared
-- after storage confirms absence; queue rows also reserve retired object keys.
-- Legacy report expiry represented a URL TTL and cannot safely drive automatic
-- retention. Only newly completed reports opt into managed file retention.
ALTER TABLE report_runs ADD COLUMN file_retention_managed boolean NOT NULL DEFAULT false;
ALTER TABLE report_runs ADD COLUMN artifact_json jsonb;
ALTER TABLE report_runs ADD CONSTRAINT report_runs_artifact_object CHECK (artifact_json IS NULL OR jsonb_typeof(artifact_json) = 'object');
CREATE TABLE export_file_cleanup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_type text NOT NULL CHECK (source_type IN ('report_run', 'export_job')),
  source_id uuid NOT NULL,
  object_key text NOT NULL,
  artifact_json jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded')),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT export_file_cleanup_requests_source_key UNIQUE (tenant_id, source_type, source_id, object_key)
);
CREATE INDEX export_file_cleanup_requests_pending_idx ON export_file_cleanup_requests(tenant_id, status, created_at);
CREATE INDEX export_file_cleanup_requests_key_idx ON export_file_cleanup_requests(tenant_id, object_key);
ALTER TABLE export_file_cleanup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_file_cleanup_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY export_file_cleanup_requests_tenant_scope ON export_file_cleanup_requests
  FOR ALL TO atlas_app, atlas_worker
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND (
      (source_type = 'report_run' AND EXISTS (
        SELECT 1 FROM report_runs r WHERE r.id = source_id AND r.tenant_id = export_file_cleanup_requests.tenant_id
      )) OR
      (source_type = 'export_job' AND EXISTS (
        SELECT 1 FROM export_jobs j WHERE j.id = source_id AND j.tenant_id = export_file_cleanup_requests.tenant_id
      ))
    )
  );
REVOKE ALL ON export_file_cleanup_requests FROM PUBLIC, atlas_platform, atlas_app, atlas_worker;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON export_file_cleanup_requests FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON export_file_cleanup_requests FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON export_file_cleanup_requests TO atlas_app, atlas_worker;

-- Do not allow a terminal artifact to regain a live writer while deletion is
-- in flight, or allow any source to reuse a retired storage key afterward.
CREATE FUNCTION app.guard_export_cleanup_key() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.r2_object_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM export_file_cleanup_requests q
    WHERE q.tenant_id = NEW.tenant_id AND q.object_key = NEW.r2_object_key
      AND (TG_OP = 'INSERT' OR NEW.r2_object_key IS DISTINCT FROM OLD.r2_object_key
        OR NEW.status IN ('QUEUED', 'RUNNING'))
  ) THEN
    RAISE EXCEPTION 'Export storage key is reserved for cleanup';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER report_runs_cleanup_key_guard BEFORE INSERT OR UPDATE OF r2_object_key, status ON report_runs
  FOR EACH ROW EXECUTE FUNCTION app.guard_export_cleanup_key();
CREATE TRIGGER export_jobs_cleanup_key_guard BEFORE INSERT OR UPDATE OF r2_object_key, status ON export_jobs
  FOR EACH ROW EXECUTE FUNCTION app.guard_export_cleanup_key();
