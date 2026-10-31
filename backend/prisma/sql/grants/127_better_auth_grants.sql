-- Better Auth's tables (migration 127, docs/engineering/better-auth-design.md).
--
-- The blanket GRANT in 025_02_table_grants.sql runs after the migrations on
-- every provision and release, and would hand every role these tables back:
-- atlas_app could read password hashes, authenticator secrets and session
-- tokens. This file runs after it and narrows them again, as migration 127 does.

REVOKE ALL ON auth_sessions, auth_accounts, auth_verifications, auth_two_factors
  FROM PUBLIC, atlas_app, atlas_worker, atlas_platform;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON auth_sessions, auth_accounts, auth_verifications, auth_two_factors
  TO atlas_auth;
GRANT SELECT, INSERT, UPDATE ON auth_principals TO atlas_auth;
REVOKE DELETE ON auth_principals FROM atlas_auth;

-- Session and login-method metadata for the console, never a token, password
-- hash or OAuth token.
GRANT SELECT (id, user_id, expires_at, ip_address, user_agent, assurance_level,
              mfa_verified_at, created_at, updated_at)
  ON auth_sessions TO atlas_platform;
GRANT DELETE ON auth_sessions TO atlas_platform;
GRANT SELECT (id, user_id, provider_id, created_at, updated_at)
  ON auth_accounts TO atlas_platform;

-- Claiming an unclaimed principal checks it has no platform grant (migration 128).
GRANT SELECT ON platform_operators TO atlas_auth;
REVOKE INSERT, UPDATE, DELETE ON platform_operators FROM atlas_auth;
