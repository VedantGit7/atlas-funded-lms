import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Regression test for audit finding C5.
 *
 * Before the fix the application connected as `atlas` (rolsuper = true,
 * rolbypassrls = true). A probe showed that any query reaching the database
 * without `SET LOCAL ROLE atlas_app` returned rows for EVERY tenant, so RLS
 * provided no backstop at all and tenant isolation depended entirely on
 * application discipline.
 *
 * These tests assert the database-layer guarantee directly, using the
 * non-superuser login role, so a future change that re-elevates the connecting
 * role (or grants it atlas_platform) fails here rather than in production.
 *
 * Skipped unless ATLAS_APP_LOGIN_URL is provided, since it needs a connection
 * as the restricted role rather than the admin one.
 */

const appLoginUrl = process.env["ATLAS_APP_LOGIN_URL"];
const adminUrl = process.env["DATABASE_URL"];
const describeWithLoginRole = appLoginUrl && adminUrl ? describe : describe.skip;

const tenantA = randomUUID();
const tenantB = randomUUID();

let admin: Client;
let app: Client;

describeWithLoginRole("RLS backstop under the non-superuser application role", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();

    for (const [id, tag] of [
      [tenantA, "a"],
      [tenantB, "b"],
    ] as const) {
      await admin.query(
        `insert into tenants (id, slug, display_name, state, updated_at)
         values ($1::uuid, $2, $3, 'ACTIVE', now())`,
        [id, `c5-${tag}-${id.slice(0, 8)}`, `c5-${tag}`],
      );
      await admin.query(
        `insert into tenant_branding (id, tenant_id, display_name, updated_at)
         values ($1::uuid, $2::uuid, $3, now())`,
        [randomUUID(), id, `brand-${tag}`],
      );
    }

    app = new Client({ connectionString: appLoginUrl });
    await app.connect();
  });

  afterAll(async () => {
    await app.end();
    await admin.query(`delete from tenant_branding where tenant_id in ($1::uuid,$2::uuid)`, [
      tenantA,
      tenantB,
    ]);
    await admin.query(`delete from tenants where id in ($1::uuid,$2::uuid)`, [tenantA, tenantB]);
    await admin.end();
  });

  it("connects as a role that cannot bypass RLS", async () => {
    const { rows } = await app.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `select rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );

    expect(rows[0]?.rolsuper).toBe(false);
    expect(rows[0]?.rolbypassrls).toBe(false);
  });

  it("isolates tenants even when SET LOCAL ROLE is omitted", async () => {
    await app.query("begin");
    // Deliberately NO `set local role atlas_app` — this is the C5 scenario.
    await app.query(`select set_config('app.tenant_id', $1, true)`, [tenantA]);

    const { rows } = await app.query<{ tid: string }>(
      `select tenant_id::text as tid from tenant_branding where tenant_id in ($1::uuid,$2::uuid)`,
      [tenantA, tenantB],
    );
    await app.query("rollback");

    const seen = new Set(rows.map((r) => r.tid));
    expect(seen.has(tenantA)).toBe(true);
    expect(seen.has(tenantB)).toBe(false);
  });

  it("returns nothing at all when no tenant context is set", async () => {
    const { rows } = await app.query<{ n: number }>(
      `select count(*)::int as n from tenant_branding`,
    );

    expect(rows[0]?.n).toBe(0);
  });

  it("cannot assume the platform role", async () => {
    await app.query("begin");
    await expect(app.query("set local role atlas_platform")).rejects.toThrow(/permission denied/i);
    await app.query("rollback").catch(() => undefined);
  });
});
