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

-- Platform operator grants (H7). Migration 101 sets these, but this file is
-- applied *after* `prisma migrate deploy` during db:provision and re-run by
-- db:sql:apply, so the blanket GRANT above silently restored write access to
-- the tenant application roles on every freshly provisioned database. Left as
-- it was, atlas_app could INSERT its own row here and self-escalate to platform
-- operator, which is the exact privilege boundary H7 exists to draw.
--
-- Grants are soft-revoked (revoked_at) rather than deleted, so nothing may
-- DELETE from this table -- not even atlas_platform.
-- proctoring_events is append-only evidence: migration 098 grants only
-- SELECT and INSERT, but it never revoked the rest, so the blanket GRANT above
-- handed every role UPDATE and DELETE on a freshly provisioned database and the
-- tamper-evidence guarantee was lost. Same mechanism as platform_operators
-- below: GRANT ... ON ALL TABLES only covers tables that exist when it runs, so
-- a migration-created table is narrow on an incrementally-migrated database and
-- wide on a fresh provision, where this file runs last.
REVOKE UPDATE, DELETE ON proctoring_events FROM atlas_app, atlas_worker, atlas_platform;

-- M11 metering counters are evidence of consumption; the tenant plane may
-- record and read them but never erase them. Declared here as well as in
-- migration 103 because the blanket GRANT above runs after migrate deploy on a
-- fresh provision and would otherwise hand back DELETE.
REVOKE DELETE ON entitlement_usage FROM atlas_app, atlas_worker;

GRANT SELECT ON platform_operators TO atlas_app, atlas_worker;
REVOKE INSERT, UPDATE, DELETE ON platform_operators FROM atlas_app, atlas_worker;

GRANT SELECT, INSERT, UPDATE ON platform_operators TO atlas_platform;
REVOKE DELETE ON platform_operators FROM atlas_platform;

-- DoD item 8 supplier cost tables (migration 106). Platform-global and
-- commercially sensitive: the tenant roles get nothing, not even SELECT, and the
-- rate history is append-only even for the platform role. Repeated here for the
-- same reason as the blocks above -- the blanket GRANT at the top of this file
-- runs after migrate deploy on a fresh provision.
REVOKE ALL ON platform_cost_rates FROM atlas_app, atlas_worker;
REVOKE ALL ON platform_fixed_costs FROM atlas_app, atlas_worker;

GRANT SELECT, INSERT ON platform_cost_rates TO atlas_platform;
REVOKE UPDATE, DELETE ON platform_cost_rates FROM atlas_platform;

GRANT SELECT, INSERT, UPDATE ON platform_fixed_costs TO atlas_platform;
REVOKE DELETE ON platform_fixed_costs FROM atlas_platform;

-- F03: keep cached platform responses out of tenant and worker roles even
-- after the broad grants above are reapplied during provisioning.
REVOKE ALL ON platform_idempotency_records FROM PUBLIC, atlas_app, atlas_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_idempotency_records TO atlas_platform;

-- F07: preserve durable financial request identities after baseline grants.
REVOKE DELETE ON payment_refund_intents FROM atlas_app, atlas_worker;
REVOKE ALL ON payment_refund_intents FROM atlas_platform;

-- F08: scheduling state is mutable; append-only delivery evidence is not.
REVOKE DELETE ON outbox_delivery_jobs FROM atlas_app, atlas_worker, atlas_platform;
REVOKE UPDATE, DELETE ON event_deliveries FROM atlas_app, atlas_worker, atlas_platform;

-- F08: report effect state remains private to tenant application/worker roles.
REVOKE ALL ON report_delivery_effects FROM atlas_platform;
REVOKE DELETE ON report_delivery_effects FROM atlas_app,atlas_worker;
