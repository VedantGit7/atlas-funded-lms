import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Host resolution answers one exact, verified hostname, and nothing else.
 *
 * `withGlobalDb` resolves the request host to a tenant *before* `app.tenant_id`
 * is set. Until migration 124 that worked through a permissive policy,
 * `tenant_domains_host_resolution`, which let the application role read every
 * undeleted row whenever no tenant context was set: one `select * from
 * tenant_domains` listed every tenant's hostnames, unverified custom-domain
 * claims and verification values included. (Its first version, before
 * 2026-08-19, did not even require the context to be unset, so any tenant
 * could read every other tenant's domains.)
 *
 * The lookup is now `app.resolve_tenant_host(host)`, a SECURITY DEFINER
 * function owned by a role that can see only verified, undeleted domains. This
 * test pins each half of that, because each obvious shortcut breaks one:
 * resolution must keep working with no tenant context, the table must not list
 * with no tenant context, and a tenant context must still see only its own.
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
const pendingHostB = `pending-${tenantB.slice(0, 8)}.example.test`;
const deletedHostB = `deleted-${tenantB.slice(0, 8)}.example.test`;
const tenantC = randomUUID();
const deletedTenantHost = `c-${tenantC.slice(0, 8)}.example.test`;

let admin: Client;
let app: Client;

/** Runs `sql` as `atlas_app` in a transaction that is always rolled back. */
async function asApp<T extends object>(
  sql: string,
  params: unknown[] = [],
  tenantId?: string,
): Promise<T[]> {
  await app.query("begin");
  try {
    await app.query("set local role atlas_app");
    if (tenantId) {
      await app.query(`select set_config('app.tenant_id', $1, true)`, [tenantId]);
    }
    const { rows } = await app.query<T>(sql, params);
    return rows;
  } finally {
    await app.query("rollback");
  }
}

describeWithLoginRole("tenant_domains host resolution", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();

    for (const [id, tag, state] of [
      [tenantA, "a", "ACTIVE"],
      [tenantB, "b", "ACTIVE"],
      [tenantC, "c", "DELETED"],
    ] as const) {
      await admin.query(
        `insert into tenants (id, slug, display_name, state, updated_at)
         values ($1::uuid, $2, $3, $4::"TenantState", now())`,
        [id, `hostres-${tag}-${id.slice(0, 8)}`, `hostres-${tag}`, state],
      );
    }

    for (const [tenantId, hostname, status, deleted] of [
      [tenantA, hostA, "ACTIVE", false],
      [tenantB, hostB, "ACTIVE", false],
      [tenantB, pendingHostB, "PENDING", false],
      [tenantB, deletedHostB, "ACTIVE", true],
      [tenantC, deletedTenantHost, "ACTIVE", false],
    ] as const) {
      await admin.query(
        `insert into tenant_domains (id, tenant_id, hostname, type, status, updated_at, deleted_at)
         values ($1::uuid, $2::uuid, $3, 'CUSTOM_DOMAIN', $4::"DomainStatus", now(),
                 case when $5 then now() end)`,
        [randomUUID(), tenantId, hostname, status, deleted],
      );
    }

    app = new Client({ connectionString: appLoginUrl });
    await app.connect();
  });

  afterAll(async () => {
    await app.end();
    const tenants = [tenantA, tenantB, tenantC];
    await admin.query(`delete from tenant_domains where tenant_id = any($1::uuid[])`, [tenants]);
    await admin.query(`delete from tenants where id = any($1::uuid[])`, [tenants]);
    await admin.end();
  });

  it("resolves a verified hostname with no tenant context set", async () => {
    // The lookup `withGlobalDb` performs. If this breaks, every request fails
    // to resolve its tenant.
    const rows = await asApp<{ tenant_id: string; domain_status: string }>(
      `select tenant_id::text, domain_status from app.resolve_tenant_host($1)`,
      [hostA.toUpperCase()],
    );

    expect(rows).toEqual([{ tenant_id: tenantA, domain_status: "ACTIVE" }]);
  });

  it("returns only what resolution needs, never verification values", async () => {
    const { rows } = await admin.query<{ result: string }>(
      `select pg_get_function_result('app.resolve_tenant_host(text)'::regprocedure) as result`,
    );

    expect(rows[0]?.result).toBe(
      "TABLE(tenant_id uuid, tenant_slug text, tenant_state text, domain_id uuid, domain_status text, hostname text)",
    );
  });

  it.each([
    ["an unverified domain", () => pendingHostB],
    ["a deleted domain", () => deletedHostB],
    ["a deleted tenant's domain", () => deletedTenantHost],
    ["an unknown hostname", () => "nobody.example.test"],
  ])("answers %s with nothing, alike", async (_label, host) => {
    const rows = await asApp(`select * from app.resolve_tenant_host($1)`, [host()]);
    expect(rows).toEqual([]);
  });

  it("does not list tenant_domains with no tenant context set", async () => {
    const rows = await asApp<{ hostname: string }>(
      `select hostname from tenant_domains where tenant_id in ($1::uuid, $2::uuid)`,
      [tenantA, tenantB],
    );

    expect(rows).toEqual([]);
  });

  it("does not expose another tenant's domains once a context is set", async () => {
    const rows = await asApp<{ tid: string }>(
      `select tenant_id::text as tid from tenant_domains where tenant_id in ($1::uuid,$2::uuid)`,
      [tenantA, tenantB],
      tenantA,
    );

    const seen = new Set(rows.map((r) => r.tid));
    expect(seen.has(tenantA)).toBe(true);
    expect(seen.has(tenantB)).toBe(false);
  });

  it("cannot become the resolver role to read the table directly", async () => {
    await app.query("begin");
    try {
      await expect(app.query("set local role atlas_host_resolver")).rejects.toThrow(
        /permission denied/i,
      );
    } finally {
      await app.query("rollback");
    }
  });

  it("keeps the catalog in the shape migration 124 left it", async () => {
    const { rows: oldPolicy } = await admin.query(
      `select 1 from pg_policy
        where polrelid = 'public.tenant_domains'::regclass
          and polname = 'tenant_domains_host_resolution'`,
    );
    expect(oldPolicy).toEqual([]);

    const { rows: fn } = await admin.query<{
      definer: boolean;
      owner: string;
      config: string[] | null;
      public_execute: boolean;
      app_execute: boolean;
    }>(
      `select p.prosecdef as definer,
              pg_get_userbyid(p.proowner) as owner,
              p.proconfig as config,
              has_function_privilege('public', p.oid, 'execute') as public_execute,
              has_function_privilege('atlas_app', p.oid, 'execute') as app_execute
         from pg_proc p
        where p.oid = 'app.resolve_tenant_host(text)'::regprocedure`,
    );
    expect(fn[0]).toMatchObject({
      definer: true,
      owner: "atlas_host_resolver",
      public_execute: false,
      app_execute: true,
    });
    expect(fn[0]?.config).toContain("search_path=pg_catalog, pg_temp");

    const { rows: role } = await admin.query(
      `select rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname = 'atlas_host_resolver'`,
    );
    expect(role).toEqual([{ rolcanlogin: false, rolsuper: false, rolbypassrls: false }]);
  });
});
