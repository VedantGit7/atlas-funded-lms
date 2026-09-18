import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Regression test for the `tenant_domains` cross-tenant read, found while
 * re-verifying Phase 2.1 on 2026-08-19.
 *
 * `withGlobalDb` resolves a hostname to a tenant *before* `app.tenant_id` is
 * set, so `tenant_domains_tenant_isolation` matches nothing at that point and
 * lookup would return zero rows. A permissive policy
 * `USING (deleted_at IS NULL)` had been added to the live databases to make it
 * work — and was never committed, so `db:provision` did not create it.
 *
 * PostgreSQL ORs permissive policies, so that policy read as
 * `(deleted_at IS NULL) OR (tenant_id = app.current_tenant_id())`, making the
 * isolation policy unreachable: any tenant context could enumerate every
 * academy's hostnames. `db:rls:check` still reported RLS "enabled and forced"
 * throughout, because table flags cannot see this.
 *
 * Both properties are asserted here, because fixing one by breaking the other
 * is the obvious wrong turn: host resolution must keep working with no tenant
 * context, and must not leak once a context exists.
 *
 * Skipped unless ATLAS_APP_LOGIN_URL is set, since it needs the restricted
 * application role rather than the admin one.
 */

const appLoginUrl = process.env["ATLAS_APP_LOGIN_URL"];
const adminUrl = process.env["DATABASE_URL"];
const describeWithLoginRole = appLoginUrl && adminUrl ? describe : describe.skip;

const tenantA = randomUUID();
const tenantB = randomUUID();
const hostA = `a-${tenantA.slice(0, 8)}.example.test`;
const hostB = `b-${tenantB.slice(0, 8)}.example.test`;

let admin: Client;
let app: Client;

describeWithLoginRole("tenant_domains host resolution vs tenant isolation", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();

    for (const [id, tag, hostname] of [
      [tenantA, "a", hostA],
      [tenantB, "b", hostB],
    ] as const) {
      await admin.query(
        `insert into tenants (id, slug, display_name, state, updated_at)
         values ($1::uuid, $2, $3, 'ACTIVE', now())`,
        [id, `hostres-${tag}-${id.slice(0, 8)}`, `hostres-${tag}`],
      );
      await admin.query(
        `insert into tenant_domains (id, tenant_id, hostname, type, status, updated_at)
         values ($1::uuid, $2::uuid, $3, 'ATLAS_SUBDOMAIN', 'ACTIVE', now())`,
        [randomUUID(), id, hostname],
      );
    }

    app = new Client({ connectionString: appLoginUrl });
    await app.connect();
  });

  afterAll(async () => {
    await app.end();
    await admin.query(`delete from tenant_domains where tenant_id in ($1::uuid,$2::uuid)`, [
      tenantA,
      tenantB,
    ]);
    await admin.query(`delete from tenants where id in ($1::uuid,$2::uuid)`, [tenantA, tenantB]);
    await admin.end();
  });

  it("resolves a hostname with no tenant context set", async () => {
    // The pre-context lookup `withGlobalDb` performs. If this breaks, every
    // request fails to resolve its tenant.
    await app.query("begin");
    await app.query("set local role atlas_app");

    const { rows } = await app.query<{ tid: string }>(
      `select tenant_id::text as tid from tenant_domains where hostname = $1`,
      [hostA],
    );
    await app.query("rollback");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tid).toBe(tenantA);
  });

  it("does not expose another tenant's domains once a context is set", async () => {
    await app.query("begin");
    await app.query("set local role atlas_app");
    await app.query(`select set_config('app.tenant_id', $1, true)`, [tenantA]);

    const { rows } = await app.query<{ tid: string }>(
      `select tenant_id::text as tid from tenant_domains where tenant_id in ($1::uuid,$2::uuid)`,
      [tenantA, tenantB],
    );
    await app.query("rollback");

    const seen = new Set(rows.map((r) => r.tid));
    expect(seen.has(tenantA)).toBe(true);
    expect(seen.has(tenantB)).toBe(false);
  });

  it("scopes the host-resolution policy to the no-context case", async () => {
    // Asserted on the policy itself, so a future edit that drops the
    // `current_tenant_id() IS NULL` clause fails here with a clear reason
    // rather than only as a row-count surprise elsewhere.
    const { rows } = await admin.query<{ qual: string | null }>(
      `select pg_get_expr(polqual, polrelid) as qual
         from pg_policy
        where polrelid = 'public.tenant_domains'::regclass
          and polname = 'tenant_domains_host_resolution'`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.qual).toContain("current_tenant_id");
  });
});
