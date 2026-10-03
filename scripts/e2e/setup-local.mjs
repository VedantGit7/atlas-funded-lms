import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import pg from "pg";
import { localEnv } from "./local-env.mjs";
import { assertIsolatedFixtureTarget } from "./isolated-target.mjs";
const env = { ...process.env, ...localEnv() };
assertIsolatedFixtureTarget({ databaseUrl: env.DATABASE_URL, authUrl: env.SUPABASE_URL });
mkdirSync(".test-results/f16", { recursive: true });
const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();
try {
  await db.query(
    "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOLOGIN; END IF; END $$",
  );
  const exists = await db.query("SELECT 1 FROM pg_database WHERE datname='atlas_auth_e2e'");
  if (!exists.rowCount) await db.query("CREATE DATABASE atlas_auth_e2e");
  await db.query("ALTER DATABASE atlas_auth_e2e SET search_path TO auth, public");
} finally {
  await db.end();
}
const authDb = new pg.Client({
  connectionString: env.DATABASE_URL.replace("/atlas_lms_e2e", "/atlas_auth_e2e"),
});
await authDb.connect();
try {
  await authDb.query("CREATE SCHEMA IF NOT EXISTS auth");
} finally {
  await authDb.end();
}
function run(file, args = []) {
  execFileSync(process.execPath, [file, ...args], { env, stdio: "inherit" });
}
run("scripts/db/apply-sql-directory.mjs", ["backend/prisma/sql/setup"]);
const rolesDb = new pg.Client({ connectionString: env.DATABASE_URL });
await rolesDb.connect();
try {
  await rolesDb.query(readFileSync("backend/prisma/sql/grants/025_01_roles.sql", "utf8"));
} finally {
  await rolesDb.end();
}
run("node_modules/prisma/build/index.js", [
  "migrate",
  "deploy",
  "--config",
  "backend/prisma.config.ts",
]);
for (const phase of ["functions", "rls", "triggers", "indexes", "grants", "partitions"])
  run("scripts/db/apply-sql-directory.mjs", [`backend/prisma/sql/${phase}`]);
run("scripts/db/setup-login-roles.mjs");
run("node_modules/tsx/dist/cli.mjs", ["backend/prisma/seeds/index.ts", "catalogues", "--apply"]);
for (const tenant of ["fundedbeyond", "second-smoke-academy"])
  run("node_modules/tsx/dist/cli.mjs", [
    "--tsconfig",
    "backend/apps/api/tsconfig.json",
    "scripts/tenants/apply.ts",
    "--tenant",
    tenant,
  ]);
console.log("Isolated database provisioned. Restart local auth, then seed users and scenarios.");
