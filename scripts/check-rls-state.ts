import { Client } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    console.error("DATABASE_URL is required for db:rls:check");
    process.exit(1);
  }

  const sql = `
WITH tenant_tables AS (
  SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN information_schema.columns col
    ON col.table_schema = n.nspname
   AND col.table_name = c.relname
   AND col.column_name = 'tenant_id'
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
)
SELECT relname
FROM tenant_tables
WHERE relrowsecurity IS NOT TRUE
   OR relforcerowsecurity IS NOT TRUE
ORDER BY relname;
`;

  // Vacuity guard. The query above only inspects tables that exist, so an empty or
  // partially-migrated database reports zero failures and "passes" while verifying
  // nothing. Require a realistic floor of tenant tables before trusting the result.
  const MINIMUM_TENANT_TABLES = 200;

  const countSql = `
SELECT count(*)::int AS total
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'tenant_id';
`;

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // ---------------------------------------------------------------------
    // Privilege check (C5).
    //
    // The flag checks below only prove RLS is *enabled*. They passed on a
    // database where a direct probe showed a full bypass, because the
    // application connected as a superuser with BYPASSRLS — for such a role
    // RLS is simply not applied, whatever the table flags say.
    //
    // A guard that cannot detect the bypass it exists to prevent is worse than
    // no guard, so assert the connecting role's privileges too.
    // ---------------------------------------------------------------------
    const privileges = await client.query<{
      usr: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      `select current_user as usr, rolsuper, rolbypassrls
         from pg_roles
        where rolname = current_user`,
    );

    const role = privileges.rows[0];
    const canBypassRls = Boolean(role?.rolsuper || role?.rolbypassrls);

    if (canBypassRls) {
      const appEnv = process.env["APP_ENV"] ?? "";
      const mustEnforce =
        process.env["REQUIRE_NON_SUPERUSER_DB"] === "1" ||
        appEnv === "production" ||
        appEnv === "staging";

      const detail =
        `role "${role?.usr}" has rolsuper=${role?.rolsuper} rolbypassrls=${role?.rolbypassrls}, ` +
        `so row-level security does not apply to it and provides no backstop.`;

      if (mustEnforce) {
        console.error(`RLS check FAILED: ${detail}`);
        console.error("Connect as atlas_app_login (see sql/grants/025_03_login_roles.sql).");
        process.exit(1);
      }

      console.warn(`WARNING: ${detail}`);
      console.warn(
        "Local development only. Set REQUIRE_NON_SUPERUSER_DB=1 (or APP_ENV=production) to enforce.",
      );
    }

    const countResult = await client.query<{ total: number }>(countSql);
    const tenantTableCount = countResult.rows[0]?.total ?? 0;

    if (tenantTableCount < MINIMUM_TENANT_TABLES) {
      console.error(
        `RLS check FAILED: only ${tenantTableCount} tenant tables found ` +
          `(expected at least ${MINIMUM_TENANT_TABLES}).`,
      );
      console.error(
        "The database is empty or partially migrated, so this check would pass vacuously.",
      );
      console.error("Provision it first: pnpm db:provision");
      process.exit(1);
    }

    const result = await client.query<{ relname: string }>(sql);
    const failures = result.rows.map((row) => row.relname);

    if (failures.length > 0) {
      console.error("RLS is not enabled/forced on these tenant tables:");
      for (const tableName of failures) {
        console.error(tableName);
      }
      process.exit(1);
    }

    // Enabling RLS is not the same as enforcing isolation.
    //
    // PostgreSQL ORs permissive policies together, so a single permissive
    // policy on the application role whose USING clause never mentions
    // `current_tenant_id()` makes the isolation policy beside it unreachable.
    // `tenant_domains_host_resolution USING (deleted_at IS NULL)` did exactly
    // that: every table below reported RLS "enabled and forced" while any
    // tenant context could read every tenant's hostnames. Table flags alone
    // could not see it — the same blind spot that let the pre-2.1 check pass on
    // a database where bypass was trivially demonstrable.
    const permissiveResult = await client.query<{
      relname: string;
      polname: string;
      qual: string | null;
    }>(
      `select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid) as qual
         from pg_policy p
         join pg_class c on c.oid = p.polrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and p.polpermissive
          and exists (
            select 1 from pg_roles r
             where r.oid = any(p.polroles) and r.rolname in ('atlas_app', 'atlas_worker')
          )
          and exists (
            select 1 from information_schema.columns col
             where col.table_schema = 'public'
               and col.table_name = c.relname
               and col.column_name = 'tenant_id'
          )
          and coalesce(pg_get_expr(p.polqual, p.polrelid), '') not like '%current_tenant_id%'
        order by c.relname, p.polname`,
    );

    if (permissiveResult.rows.length > 0) {
      console.error(
        "RLS check FAILED: permissive policies on the application role that do not scope by tenant.",
      );
      console.error(
        "PostgreSQL ORs permissive policies, so each of these defeats the isolation policy on the same table:",
      );
      for (const row of permissiveResult.rows) {
        console.error(`  ${row.relname}.${row.polname}  USING (${row.qual ?? "true"})`);
      }
      console.error(
        "\nScope the policy to the case it exists for — e.g. add `AND app.current_tenant_id() IS NULL` " +
          "for a pre-context lookup — or make it RESTRICTIVE.",
      );
      process.exit(1);
    }

    console.log(
      `PASS: RLS is enabled and forced on all ${tenantTableCount} tenant_id tables, ` +
        `and no permissive application-role policy bypasses tenant scoping.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
