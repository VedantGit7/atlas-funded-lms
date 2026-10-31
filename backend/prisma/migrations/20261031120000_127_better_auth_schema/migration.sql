-- Better Auth's tables (launch plan task 3.1; docs/engineering/better-auth-design.md).
--
-- auth_principals becomes Better Auth's user table, so a person is one row,
-- with no second identity system to keep in step. Better Auth adds sessions,
-- login methods (one holds the password hash), short-lived verification values
-- and the authenticator secret. Nothing uses them yet: the flows move over in
-- tasks 3.2 to 3.6.
--
-- None of the new tables is readable by the tenant or worker roles. Only
-- atlas_auth, the role Better Auth's own connections start as, reads password
-- hashes, authenticator secrets and session tokens. The platform role sees
-- session and login-method metadata, to list and revoke sessions. The grants
-- are repeated in sql/grants/127_better_auth_grants.sql, which runs after the
-- blanket grants on every deploy and would otherwise be widened again.
--
-- The tables are global like auth_principals, so they have no row-level
-- security: a person signs in once and may belong to several academies.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Defined in sql/grants/025_01_roles.sql, which provisioning applies before the
-- migrations. Created here too so a database migrated without that step still
-- has the role the grants and the guard below name.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas_auth') THEN
    CREATE ROLE atlas_auth NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO atlas_auth;
GRANT USAGE ON SCHEMA app TO atlas_auth;

-- Better Auth's user fields. A principal is only created for a confirmed
-- address (audit H6), so every active principal has a verified email; an
-- unclaimed placeholder has not proven one yet. Better Auth users have no
-- Supabase id, and the column goes with Supabase in task 3.8.
ALTER TABLE "auth_principals" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "supabase_user_id" DROP NOT NULL;

UPDATE "auth_principals" SET "email_verified" = true WHERE "global_status" = 'active';

-- A session is aal2 only after a second-factor check, and then says when.
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "assurance_level" TEXT NOT NULL DEFAULT 'aal1',
    "mfa_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_sessions_assurance_level_valid"
      CHECK ("assurance_level" IN ('aal1', 'aal2')),
    CONSTRAINT "auth_sessions_aal2_verified"
      CHECK ("assurance_level" = 'aal1' OR "mfa_verified_at" IS NOT NULL)
);

CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "password" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "refresh_token_expires_at" TIMESTAMPTZ(6),
    "scope" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_verifications" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_two_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_two_factors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_two_factors_failed_count_nonnegative"
      CHECK ("failed_verification_count" >= 0)
);

CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");
CREATE UNIQUE INDEX "auth_accounts_provider_id_account_id_key" ON "auth_accounts"("provider_id", "account_id");
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");
CREATE INDEX "auth_verifications_expires_at_idx" ON "auth_verifications"("expires_at");
CREATE UNIQUE INDEX "auth_two_factors_user_id_key" ON "auth_two_factors"("user_id");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_principals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_principals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_two_factors" ADD CONSTRAINT "auth_two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_principals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "auth_sessions" IS
  'Better Auth sessions. assurance_level is ours (F01): aal2 only after a second factor. atlas_auth only, metadata for atlas_platform.';
COMMENT ON TABLE "auth_accounts" IS
  'Better Auth login methods; the credential row holds the password hash. atlas_auth only, metadata for atlas_platform.';
COMMENT ON TABLE "auth_verifications" IS
  'Better Auth short-lived values: email verification, password reset, one-time codes, pending two-factor challenges. atlas_auth only.';
COMMENT ON TABLE "auth_two_factors" IS
  'Better Auth authenticator secret and backup codes, encrypted with BETTER_AUTH_SECRET. atlas_auth only.';

-- Privileges, split by role.
REVOKE ALL ON "auth_sessions", "auth_accounts", "auth_verifications", "auth_two_factors"
  FROM PUBLIC, atlas_app, atlas_worker, atlas_platform;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "auth_sessions", "auth_accounts", "auth_verifications", "auth_two_factors"
  TO atlas_auth;
-- Better Auth never deletes a principal: its delete-user endpoint is not used.
GRANT SELECT, INSERT, UPDATE ON "auth_principals" TO atlas_auth;

-- The console lists a principal's sessions and login methods and revokes
-- sessions, without seeing a token, password hash or OAuth token.
GRANT SELECT (id, user_id, expires_at, ip_address, user_agent, assurance_level,
              mfa_verified_at, created_at, updated_at)
  ON "auth_sessions" TO atlas_platform;
GRANT DELETE ON "auth_sessions" TO atlas_platform;
GRANT SELECT (id, user_id, provider_id, created_at, updated_at)
  ON "auth_accounts" TO atlas_platform;

-- Better Auth writes principals as atlas_auth, so the H6 guard covers it as
-- it covers the tenant roles: it may create active or unclaimed principals and
-- claim a placeholder, but disabling and relinking stay with the platform.
CREATE OR REPLACE FUNCTION app.guard_auth_principal_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (pg_has_role(current_user, 'atlas_app', 'MEMBER')
          OR pg_has_role(current_user, 'atlas_worker', 'MEMBER')
          OR pg_has_role(current_user, 'atlas_auth', 'MEMBER'))
     OR (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.global_status NOT IN ('active', 'unclaimed') THEN
      RAISE EXCEPTION 'auth principal status % is set by the platform plane', NEW.global_status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.supabase_user_id IS DISTINCT FROM OLD.supabase_user_id
     AND OLD.global_status <> 'unclaimed' THEN
    RAISE EXCEPTION 'auth principal % is bound to its Supabase user; relinking requires platform review', OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.global_status IS DISTINCT FROM OLD.global_status
     AND NOT (OLD.global_status = 'unclaimed' AND NEW.global_status = 'active') THEN
    RAISE EXCEPTION 'auth principal status % -> % is set by the platform plane',
      OLD.global_status, NEW.global_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
