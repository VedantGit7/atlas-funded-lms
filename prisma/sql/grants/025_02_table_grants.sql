-- Baseline schema hardening.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Tenant application and workers can operate on tenant-scoped tables.
-- RLS is the isolation backstop.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atlas_worker;

-- Platform role is structurally separate.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atlas_platform;

-- Global catalogues: normal app/worker can read catalogue/config defaults.
GRANT SELECT ON
  tenants,
  permissions,
  permission_bundles,
  feature_flags,
  item_types,
  extension_points,
  materialized_view_registry
TO atlas_app, atlas_worker;

-- Global identity bridge: app may need to create/update principals through approved identity service only.
GRANT SELECT, INSERT, UPDATE ON auth_principals TO atlas_app, atlas_worker;
REVOKE DELETE ON auth_principals FROM atlas_app, atlas_worker;

-- Catalogue writes are platform-only.
REVOKE INSERT, UPDATE, DELETE ON
  permissions,
  permission_bundles,
  feature_flags,
  item_types,
  extension_points,
  materialized_view_registry
FROM atlas_app, atlas_worker;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants,
  auth_principals,
  permissions,
  permission_bundles,
  feature_flags,
  item_types,
  extension_points,
  materialized_view_registry
TO atlas_platform;