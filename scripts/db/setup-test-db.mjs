import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

/**
 * Provision (or reset) the local automated-test database.
 *
 * Tests historically ran against the same `atlas_lms_dev` database as the dev
 * server, so leaked fixtures polluted real dev data. This script creates a
 * dedicated `atlas_lms_test` database that mirrors dev's full schema (tables,
 * roles' grants, RLS policies, append-only triggers, extensions) by cloning the
 * dev schema with pg_dump, then seeds the global catalogues. Test data created
 * there is disposable and never touches dev.
 *
 * Connection details are read from .env.test (target) and .env.local (source).
 * The Postgres instance is assumed to be the docker-compose `atlas-postgres`
 * container so pg_dump/psql run inside it (no host Postgres client required).
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const CONTAINER = process.env.ATLAS_PG_CONTAINER ?? "atlas-postgres";

function readEnvFile(relativePath) {
  const fullPath = resolve(repoRoot, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing ${relativePath}. Create it before setting up the test DB.`);
  }
  const parsed = loadEnv({ path: fullPath, processEnv: {} }).parsed ?? {};
  return parsed;
}

function parseDbName(url) {
  const match = /\/([^/?]+)(\?|$)/.exec(url);
  if (!match) {
    throw new Error(`Could not parse database name from URL: ${url}`);
  }
  return match[1];
}

function parseAdmin(url) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port || "5432",
    adminConnString: `${u.protocol}//${u.username}:${u.password}@${u.host}/postgres`,
  };
}

function dockerExec(innerCommand) {
  execSync(`docker exec ${CONTAINER} sh -lc ${JSON.stringify(innerCommand)}`, {
    stdio: "inherit",
  });
}

async function main() {
  const testEnv = readEnvFile(".env.test");
  const devEnv = readEnvFile(".env.local");

  const testUrl = testEnv.DATABASE_URL;
  const devUrl = devEnv.DATABASE_URL;
  if (!testUrl) throw new Error(".env.test must define DATABASE_URL");
  if (!devUrl) throw new Error(".env.local must define DATABASE_URL");

  const testDb = parseDbName(testUrl);
  const devDb = parseDbName(devUrl);
  const admin = parseAdmin(testUrl);

  if (testDb === devDb) {
    throw new Error(
      `Refusing to run: .env.test DATABASE_URL points at the dev database "${devDb}". ` +
        `Use a separate database (e.g. atlas_lms_test).`,
    );
  }

  console.log(`[setup-test-db] target=${testDb} source=${devDb} container=${CONTAINER}`);

  // 1. Drop & recreate the test database (terminate any stragglers first).
  const adminClient = new Client({ connectionString: admin.adminConnString });
  await adminClient.connect();
  try {
    await adminClient.query(
      `select pg_terminate_backend(pid)
         from pg_stat_activity
        where datname = $1 and pid <> pg_backend_pid()`,
      [testDb],
    );
    await adminClient.query(`drop database if exists "${testDb}"`);
    await adminClient.query(`create database "${testDb}"`);
    console.log(`[setup-test-db] recreated database ${testDb}`);
  } finally {
    await adminClient.end();
  }

  // 2. Clone dev's full schema (DDL only) into the test database, inside the
  //    container so no host Postgres client is needed.
  const pgEnv = `PGPASSWORD=${admin.password}`;
  const dumpAndLoad =
    `${pgEnv} pg_dump -U ${admin.user} -d ${devDb} --schema-only --no-owner ` +
    `| ${pgEnv} psql -v ON_ERROR_STOP=1 -U ${admin.user} -d ${testDb}`;
  console.log("[setup-test-db] cloning schema (pg_dump --schema-only -> psql)...");
  dockerExec(dumpAndLoad);

  // 3. Seed global catalogues (permissions, flags, entitlements, etc.) into the
  //    test database. Tenant data is intentionally left empty.
  console.log("[setup-test-db] seeding catalogues...");
  execSync("pnpm exec dotenv -e .env.test -- tsx backend/prisma/seeds/index.ts catalogues --apply", {
    cwd: repoRoot,
    stdio: "inherit",
  });

  console.log(`[setup-test-db] done. Test database "${testDb}" is ready.`);
}

main().catch((error) => {
  console.error("[setup-test-db] failed:", error);
  process.exit(1);
});
