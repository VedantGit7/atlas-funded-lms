import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

/**
 * Provision a database from an empty state, in the only order that works.
 *
 * Ordering is not arbitrary:
 *
 *   1. sql/setup      extensions, the `app` schema, and base helper functions.
 *                     Migration 098 calls app.reject_update_delete(), so the
 *                     function must exist BEFORE `prisma migrate deploy` runs.
 *   2. migrations     all Prisma migrations.
 *   3. sql/rls        tenant isolation policies for the base table set. These are
 *                     NOT in migrations, so migrations alone leave RLS incomplete.
 *   4. sql/triggers   append-only triggers. These ATTACH to tables, so they cannot
 *                     run before migrations create them.
 *   5. sql/indexes    partial / non-Prisma indexes.
 *   6. sql/grants     role grants.
 *   7. sql/partitions partition parents and assertions.
 *
 * Before this script existed there was no working path from an empty database to a
 * usable schema — `prisma migrate deploy` failed on a clean database, and the test
 * database was built by pg_dump-cloning dev instead.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const prismaConfig = join("backend", "prisma.config.ts");

// `functions` runs after migrations because app.verify_audit_chain() reads
// audit_entries. It was previously absent from every applier and guard, so the
// function was never deployed even though audit-chain.service.ts calls it.
const SQL_PHASES = ["functions", "rls", "triggers", "indexes", "grants", "partitions"];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for db:provision");
  process.exit(1);
}

if (!existsSync(join(repoRoot, prismaConfig))) {
  console.error(`Missing ${prismaConfig}`);
  process.exit(1);
}

function run(label, file, args) {
  console.log(`\n=== ${label} ===`);
  execFileSync(file, args, { cwd: repoRoot, stdio: "inherit", env: process.env, shell: true });
}

function applySql(phase) {
  run(`sql/${phase}`, "node", [
    join("scripts", "db", "apply-sql-directory.mjs"),
    `backend/prisma/sql/${phase}`,
  ]);
}

/**
 * This script provisions from empty. Run against an already-populated database
 * (for example atlas_lms_test, which db:test:setup builds by pg_dump-cloning dev)
 * `prisma migrate deploy` fails with a duplicate-object error and leaves a failed
 * migration marker behind. Detect that up front and explain it instead.
 */
async function assertDatabaseIsEmpty() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select count(*)::int as total
         from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'`,
    );
    const tableCount = rows[0]?.total ?? 0;
    if (tableCount > 0) {
      console.error(
        `Refusing to provision: the target database already has ${tableCount} table(s).`,
      );
      console.error("db:provision is for empty databases only.");
      console.error("  - existing database, new migrations -> pnpm db:migrate:deploy");
      console.error("  - local test database               -> pnpm db:test:setup");
      console.error("  - genuinely start over              -> drop and recreate, then re-run");
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

try {
  await assertDatabaseIsEmpty();
  applySql("setup");
  run("prisma migrate deploy", "pnpm", [
    "exec",
    "prisma",
    "migrate",
    "deploy",
    "--config",
    prismaConfig,
  ]);
  for (const phase of SQL_PHASES) {
    applySql(phase);
  }
  console.log("\nDatabase provisioned successfully.");
} catch (error) {
  console.error(`\nProvisioning FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
