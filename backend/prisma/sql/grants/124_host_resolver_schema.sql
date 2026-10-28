-- 025_01_roles.sql gives atlas_host_resolver CREATE on schema app so that
-- migration 124 can make it the owner of app.resolve_tenant_host. The role
-- never creates anything itself, so take the privilege back once migrations
-- have run. This file sorts after 025_01, which the grants phase reapplies.
REVOKE CREATE ON SCHEMA app FROM atlas_host_resolver;
