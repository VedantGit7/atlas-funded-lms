import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Client } from "pg";
import { PROTECTED_TENANT_SLUGS, TEST_TENANT_SLUG_REGEX } from "./test-tenant-slugs.mjs";

/**
 * Purge leaked automated-test tenants (and their tenant-scoped + orphaned global
 * rows) from a database.
 *
 * Test suites such as the tenant-isolation fixtures and various e2e/smoke tests
 * provision throwaway tenants with deterministic slug prefixes and an 8-char hex
 * suffix. Historically they had no teardown, so they accumulated (tens of
 * thousands of rows on shared dev databases). This module removes exactly those
 * rows and nothing else.
 *
 * Safety:
 * - Targets are matched by a strict slug regex (prefix + 8 hex chars); real
 *   tenants like `fundedbeyond` never match, and an explicit allowlist guards it.
 * - Dry-run is the default. Destructive work only runs with { apply: true }.
 * - Deletion happens in a single transaction with session_replication_role set
 *   to 'replica' so append-only and FK RESTRICT triggers don't block cleanup of
 *   test data. Requires a superuser connection (the local `atlas` role is).
 */

// Slug regex + protected slugs come from the shared source of truth so the
// purge can never drift from what the fixtures actually create.
const PROTECTED_SLUGS = PROTECTED_TENANT_SLUGS;

async function listTenantScopedTables(client) {
  const result = await client.query(`
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'tenant_id'
    order by table_name
  `);
  return result.rows.map((row) => row.table_name);
}

/**
 * @param {{ apply?: boolean, log?: (message: string) => void }} [options]
 * @returns {Promise<{ tenants: number, sampleSlugs: string[], childRows: number, principals: number, applied: boolean, perTable: Array<{ table: string, rows: number }> }>}
 */
export async function purgeTestTenants(options = {}) {
  const apply = options.apply ?? false;
  const log = options.log ?? (() => {});

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to purge test tenants.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const tenantScopedTables = await listTenantScopedTables(client);

    // Identify targets up front for reporting.
    const targets = await client.query(
      `select id::text, slug
         from tenants
        where slug ~ $1
          and slug <> all($2::text[])
        order by created_at asc`,
      [TEST_TENANT_SLUG_REGEX, PROTECTED_SLUGS],
    );

    const tenantCount = targets.rows.length;
    const sampleSlugs = targets.rows.slice(0, 10).map((row) => row.slug);

    if (tenantCount === 0) {
      log("[purge-test-tenants] no matching test tenants found.");
      return {
        tenants: 0,
        sampleSlugs: [],
        childRows: 0,
        principals: 0,
        applied: false,
        perTable: [],
      };
    }

    // Build the temp target tables once; reused for both dry-run counting and apply.
    const buildTargets = async () => {
      await client.query(
        `create temp table _purge_targets on commit drop as
           select id from tenants
            where slug ~ $1
              and slug <> all($2::text[])`,
        [TEST_TENANT_SLUG_REGEX, PROTECTED_SLUGS],
      );
      await client.query(`
        create temp table _purge_principals on commit drop as
          select distinct m.auth_principal_id as id
            from memberships m
            join _purge_targets t on t.id = m.tenant_id
      `);
    };

    if (!apply) {
      // Dry run: count everything inside a transaction, then roll back.
      await client.query("begin");
      try {
        await buildTargets();

        const perTable = [];
        let childRows = 0;
        for (const table of tenantScopedTables) {
          const countResult = await client.query(
            `select count(*)::int as n
               from "${table}" x
               join _purge_targets t on t.id = x.tenant_id`,
          );
          const rows = countResult.rows[0].n;
          if (rows > 0) {
            perTable.push({ table, rows });
            childRows += rows;
          }
        }

        const principalResult = await client.query(`
          select count(*)::int as n
            from _purge_principals p
           where not exists (
             select 1 from memberships m
              where m.auth_principal_id = p.id
                and m.tenant_id not in (select id from _purge_targets)
           )
        `);
        const principals = principalResult.rows[0].n;

        return {
          tenants: tenantCount,
          sampleSlugs,
          childRows,
          principals,
          applied: false,
          perTable,
        };
      } finally {
        await client.query("rollback");
      }
    }

    // Apply: delete in small per-tenant batches. Short transactions keep the lock
    // footprint tiny so the purge co-exists with a running dev server, and any
    // lock contention is retried instead of aborting the whole run.
    const targetIds = targets.rows.map((row) => row.id);
    const BATCH_SIZE = 200;
    const MAX_RETRIES = 6;

    const perTableTotals = new Map();
    let childRows = 0;
    let deletedTenants = 0;
    let deletedPrincipals = 0;

    const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
    const isRetryable = (error) =>
      error && (error.code === "40P01" || error.code === "55P03" || error.code === "40001");

    for (let offset = 0; offset < targetIds.length; offset += BATCH_SIZE) {
      const batch = targetIds.slice(offset, offset + BATCH_SIZE);

      for (let attempt = 1; ; attempt += 1) {
        try {
          await client.query("begin");
          await client.query("set local session_replication_role = 'replica'");
          await client.query("set local lock_timeout = '4s'");

          const principalRows = await client.query(
            `select distinct auth_principal_id as id
               from memberships
              where tenant_id = any($1::uuid[])`,
            [batch],
          );
          const principalIds = principalRows.rows.map((row) => row.id);

          for (const table of tenantScopedTables) {
            const deleteResult = await client.query(
              `delete from "${table}" where tenant_id = any($1::uuid[])`,
              [batch],
            );
            const rows = deleteResult.rowCount ?? 0;
            if (rows > 0) {
              perTableTotals.set(table, (perTableTotals.get(table) ?? 0) + rows);
              childRows += rows;
            }
          }

          const tenantDelete = await client.query(
            `delete from tenants where id = any($1::uuid[])`,
            [batch],
          );
          deletedTenants += tenantDelete.rowCount ?? 0;

          if (principalIds.length > 0) {
            const principalDelete = await client.query(
              `delete from auth_principals a
                where a.id = any($1::uuid[])
                  and not exists (
                    select 1 from memberships m where m.auth_principal_id = a.id
                  )`,
              [principalIds],
            );
            deletedPrincipals += principalDelete.rowCount ?? 0;
          }

          await client.query("commit");
          break;
        } catch (error) {
          await client.query("rollback").catch(() => {});
          if (isRetryable(error) && attempt < MAX_RETRIES) {
            log(
              `[purge-test-tenants] batch at offset ${offset} hit ${error.code}; ` +
                `retry ${attempt}/${MAX_RETRIES - 1}`,
            );
            await sleep(250 * attempt);
            continue;
          }
          throw error;
        }
      }
    }

    const perTable = [...perTableTotals.entries()].map(([table, rows]) => ({ table, rows }));

    return {
      tenants: deletedTenants,
      sampleSlugs,
      childRows,
      principals: deletedPrincipals,
      applied: true,
      perTable,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const report = await purgeTestTenants({
    apply,
    log: (message) => {
      console.log(message);
    },
  });

  console.log(`[purge-test-tenants] mode=${apply ? "apply" : "dry-run"}`);
  console.log(`[purge-test-tenants] matched test tenants: ${report.tenants}`);
  if (report.sampleSlugs.length > 0) {
    console.log(`[purge-test-tenants] sample slugs: ${report.sampleSlugs.join(", ")}`);
  }

  if (report.perTable.length > 0) {
    console.log(`[purge-test-tenants] ${apply ? "deleted" : "would delete"} child rows by table:`);
    for (const entry of report.perTable.sort((a, b) => b.rows - a.rows)) {
      console.log(`  ${entry.table}: ${entry.rows}`);
    }
  }

  console.log(
    `[purge-test-tenants] ${apply ? "deleted" : "would delete"} ${report.childRows} child rows, ` +
      `${report.tenants} tenants, ${report.principals} orphaned principals.`,
  );

  if (!apply && report.tenants > 0) {
    console.log("[purge-test-tenants] re-run with --apply to perform the deletion.");
  }
}

const entryPath = process.argv[1];
if (entryPath && fileURLToPath(import.meta.url) === resolve(entryPath)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
