CREATE UNIQUE INDEX IF NOT EXISTS courses_tenant_slug_active_uq
ON courses (tenant_id, slug)
WHERE deleted_at IS NULL;