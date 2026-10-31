import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Table-privilege regression test.
 *
 * Some tables are deliberately narrower than the blanket
 * `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public` that
 * `sql/grants/025_02_table_grants.sql` applies:
 *
 * - `platform_operators` (H7) — the tenant application roles may read a grant
 *   but never write one, or `atlas_app` could insert its own row and promote
 *   itself to platform operator.
 * - `proctoring_events` — append-only evidence, so nothing may UPDATE or
 *   DELETE it.
 * - Better Auth's tables (migration 127) — password hashes, authenticator
 *   secrets and session tokens, for `atlas_auth` only.
 *
 * The first two were silently wide open on any freshly provisioned database, and the bug
 * is worth describing because it is not obvious: `GRANT ... ON ALL TABLES`
 * affects only the tables that exist at the moment it runs. A migration that
 * creates a table with narrow grants therefore stays narrow on a database that
 * was migrated incrementally — dev — and is re-widened on a fresh provision,
 * where `db:provision` applies the grants directory *after* `migrate deploy`.
 * So the dev database looked correct while production would not have been, and
 * no existing check compared the two.
 *
 * This asserts the privileges directly from the catalogue, which is true
 * regardless of how the database was built.
 *
 * Skipped unless DATABASE_URL is set.
 */

const adminUrl = process.env["DATABASE_URL"];
const describeWithDb = adminUrl ? describe : describe.skip;

let admin: Client;

async function privileges(table: string, grantee: string): Promise<string[]> {
  const { rows } = await admin.query<{ privilege_type: string }>(
    `select privilege_type
       from information_schema.table_privileges
      where table_schema = 'public'
        and table_name = $1
        and grantee = $2`,
    [table, grantee],
  );
  return rows.map((row) => row.privilege_type).sort();
}

describeWithDb("table privilege boundaries", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
  });

  afterAll(async () => {
    await admin.end();
  });

  it("lets the application roles read platform operator grants but never write them", async () => {
    for (const role of ["atlas_app", "atlas_worker"]) {
      expect(await privileges("platform_operators", role), role).toEqual(["SELECT"]);
    }
  });

  it("lets the platform role grant and revoke, but never hard-delete, an operator", async () => {
    // Revocation is a soft revoke (revoked_at) so the grant history survives.
    expect(await privileges("platform_operators", "atlas_platform")).toEqual([
      "INSERT",
      "SELECT",
      "UPDATE",
    ]);
  });

  it("gives Better Auth's tables to atlas_auth only", async () => {
    // Password hashes, authenticator secrets and session tokens (migration 127).
    for (const table of [
      "auth_sessions",
      "auth_accounts",
      "auth_verifications",
      "auth_two_factors",
    ]) {
      for (const role of ["atlas_app", "atlas_worker"]) {
        expect(await privileges(table, role), `${role} ${table}`).toEqual([]);
      }
      expect(await privileges(table, "atlas_auth"), table).toEqual([
        "DELETE",
        "INSERT",
        "SELECT",
        "UPDATE",
      ]);
    }
    expect(await privileges("auth_principals", "atlas_auth")).toEqual([
      "INSERT",
      "SELECT",
      "UPDATE",
    ]);
  });

  it("lets the platform role list and revoke sessions without reading a token or hash", async () => {
    expect(await privileges("auth_sessions", "atlas_platform")).toEqual(["DELETE"]);
    expect(await privileges("auth_verifications", "atlas_platform")).toEqual([]);
    expect(await privileges("auth_two_factors", "atlas_platform")).toEqual([]);
    const { rows } = await admin.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name
         from information_schema.column_privileges
        where table_schema = 'public'
          and table_name in ('auth_sessions', 'auth_accounts')
          and grantee = 'atlas_platform'
          and privilege_type = 'SELECT'`,
    );
    const columns = rows.map((row) => `${row.table_name}.${row.column_name}`);
    expect(columns).toContain("auth_sessions.assurance_level");
    expect(columns).toContain("auth_accounts.provider_id");
    for (const secret of [
      "auth_sessions.token",
      "auth_accounts.password",
      "auth_accounts.access_token",
      "auth_accounts.refresh_token",
      "auth_accounts.id_token",
    ]) {
      expect(columns).not.toContain(secret);
    }
  });

  it("lets the API login switch to atlas_auth without inheriting it", async () => {
    const { rows } = await admin.query<{ can_set: boolean; inherits: boolean; reads: boolean }>(
      `select pg_has_role('atlas_app_login', 'atlas_auth', 'SET') as can_set,
              pg_has_role('atlas_app_login', 'atlas_auth', 'USAGE') as inherits,
              has_table_privilege('atlas_app_login', 'public.auth_accounts', 'SELECT') as reads`,
    );
    expect(rows[0]).toEqual({ can_set: true, inherits: false, reads: false });
  });

  it("keeps proctoring_events append-only for every role", async () => {
    for (const role of ["atlas_app", "atlas_worker", "atlas_platform"]) {
      expect(await privileges("proctoring_events", role), role).toEqual(["INSERT", "SELECT"]);
    }
  });
});
