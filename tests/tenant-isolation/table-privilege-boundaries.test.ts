import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Table-privilege regression test.
 *
 * Two tables are deliberately narrower than the blanket
 * `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public` that
 * `sql/grants/025_02_table_grants.sql` applies:
 *
 * - `platform_operators` (H7) — the tenant application roles may read a grant
 *   but never write one, or `atlas_app` could insert its own row and promote
 *   itself to platform operator.
 * - `proctoring_events` — append-only evidence, so nothing may UPDATE or
 *   DELETE it.
 *
 * Both were silently wide open on any freshly provisioned database, and the bug
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

  it("keeps proctoring_events append-only for every role", async () => {
    for (const role of ["atlas_app", "atlas_worker", "atlas_platform"]) {
      expect(await privileges("proctoring_events", role), role).toEqual(["INSERT", "SELECT"]);
    }
  });
});
