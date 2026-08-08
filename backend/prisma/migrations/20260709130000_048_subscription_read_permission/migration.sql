-- Migration 048: grant subscription.read for existing tenants after catalogue addition.

INSERT INTO permissions (
  id,
  key,
  description,
  created_at
)
VALUES (
  '8d063584-a6a4-4564-8562-301f25850c6b',
  'subscription.read',
  'View tenant subscriptions',
  now()
)
ON CONFLICT (key) DO UPDATE SET
  description = excluded.description;

INSERT INTO role_permissions (
  id,
  tenant_id,
  role_id,
  permission_key,
  created_at
)
SELECT
  gen_random_uuid(),
  r.tenant_id,
  r.id,
  'subscription.read',
  now()
FROM roles r
WHERE r.key IN ('owner', 'admin')
  AND r.deleted_at IS NULL
ON CONFLICT (tenant_id, role_id, permission_key) DO NOTHING;
