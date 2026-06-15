CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_key_active_uq
ON roles (tenant_id, key)
WHERE deleted_at IS NULL;