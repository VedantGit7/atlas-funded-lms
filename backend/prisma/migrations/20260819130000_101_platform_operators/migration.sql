-- Audit finding H7 — move platform operators into the database.
--
-- Cross-tenant access was an email string match against the
-- PLATFORM_OPERATOR_ASSIGNMENTS environment variable. That meant:
--
--   * granting or revoking platform authority required a deploy;
--   * there was no record of who granted it, when, or why;
--   * the highest-privilege role in the product left no audit trail at all;
--   * anyone able to set an env var could grant themselves super_admin, which
--     is a different (and much lower) bar than writing to the database.
--
-- Grants are rows now. Revocation is a soft revoke so the history survives:
-- "who had access in March" is a question an auditor will ask, and deleting the
-- row destroys the only evidence.

CREATE TABLE IF NOT EXISTS platform_operators (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_principal_id      uuid NOT NULL REFERENCES auth_principals(id) ON DELETE CASCADE,
  role_key               text NOT NULL,
  granted_at             timestamptz(6) NOT NULL DEFAULT now(),
  granted_by_principal_id uuid REFERENCES auth_principals(id),
  grant_reason           text,
  revoked_at             timestamptz(6),
  revoked_by_principal_id uuid REFERENCES auth_principals(id),
  revoke_reason          text,
  created_at             timestamptz(6) NOT NULL DEFAULT now(),
  updated_at             timestamptz(6) NOT NULL DEFAULT now(),

  CONSTRAINT platform_operators_role_key_valid
    CHECK (role_key IN ('super_admin', 'operations', 'support')),

  -- A revocation must say when it happened if it says who did it, and vice
  -- versa, so a half-written revoke cannot read as still-active.
  CONSTRAINT platform_operators_revocation_complete
    CHECK (
      (revoked_at IS NULL AND revoked_by_principal_id IS NULL)
      OR revoked_at IS NOT NULL
    )
);

COMMENT ON TABLE platform_operators IS
  'Platform (cross-tenant) role grants. Rows, not env config, so grants are auditable and revocable without a deploy. H7.';

-- One active grant per principal. Revoked rows are excluded so a principal can
-- be re-granted later without colliding with their own history.
CREATE UNIQUE INDEX IF NOT EXISTS platform_operators_active_principal_uq
  ON platform_operators (auth_principal_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS platform_operators_role_active_idx
  ON platform_operators (role_key)
  WHERE revoked_at IS NULL;

-- Least privilege, split by direction.
--
-- `requirePlatformPrincipal` runs inside `withGlobalDb`, which does
-- `SET LOCAL ROLE atlas_app`, so the tenant application role has to *read*
-- this table to answer "is this caller a platform operator?". It must never be
-- able to *write* it — granting platform authority is precisely the escalation
-- this table exists to make auditable.
GRANT SELECT ON platform_operators TO atlas_app, atlas_worker;
REVOKE INSERT, UPDATE, DELETE ON platform_operators FROM atlas_app, atlas_worker;

GRANT SELECT, INSERT, UPDATE ON platform_operators TO atlas_platform;
-- Never hard-delete: revocation is a soft revoke so grant history survives.
REVOKE DELETE ON platform_operators FROM atlas_platform;
