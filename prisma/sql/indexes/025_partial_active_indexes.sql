DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('tenant_domains', 'tenant_domains_hostname_active_uq', 'hostname'),
        ('roles', 'roles_tenant_key_active_uq', 'tenant_id, key'),
        ('courses', 'courses_tenant_slug_active_uq', 'tenant_id, slug'),
        ('learning_paths', 'learning_paths_tenant_slug_active_uq', 'tenant_id, slug'),
        ('item_collections', 'item_collections_tenant_slug_active_uq', 'tenant_id, slug'),
        ('certificate_templates', 'certificate_templates_tenant_key_active_uq', 'tenant_id, key'),
        ('community_spaces', 'community_spaces_tenant_slug_active_uq', 'tenant_id, slug')
    ) AS v(table_name, index_name, column_sql)
  LOOP
    IF to_regclass('public.' || quote_ident(r.table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping missing soft-delete table: %', r.table_name;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = r.table_name
        AND column_name = 'deleted_at'
    ) THEN
      RAISE NOTICE 'Skipping table without deleted_at: %', r.table_name;
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (%s) WHERE deleted_at IS NULL',
      r.index_name,
      r.table_name,
      r.column_sql
    );
  END LOOP;
END $$;

-- Hot-path safety indexes. These are idempotent and intentionally tenant-leading.
CREATE INDEX IF NOT EXISTS audit_entries_tenant_occurred_at_idx
ON audit_entries (tenant_id, occurred_at);

CREATE INDEX IF NOT EXISTS audit_entries_tenant_action_occurred_at_idx
ON audit_entries (tenant_id, action, occurred_at);

CREATE INDEX IF NOT EXISTS outbox_events_available_at_idx
ON outbox_events (available_at);

CREATE INDEX IF NOT EXISTS notification_dispatches_tenant_status_created_at_idx
ON notification_dispatches (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS export_jobs_tenant_status_created_at_idx
ON export_jobs (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS deletion_requests_tenant_target_idx
ON deletion_requests (tenant_id, target_type, target_id);