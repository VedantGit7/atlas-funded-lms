import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const user = process.env.CI_POSTGRES_USER;
const password = process.env.CI_POSTGRES_PASSWORD;
const database = process.env.CI_POSTGRES_DB;

if (!user || !password || !database) {
  console.error(
    "CI postgres env vars are required: CI_POSTGRES_USER, CI_POSTGRES_PASSWORD, CI_POSTGRES_DB",
  );
  process.exit(1);
}

const url = (login, secret, name) =>
  ["postgresql:", "//", login, ":", secret, "@", "localhost:5432/", name, "?schema=public"].join(
    "",
  );

// Deployed databases migrate as a non-superuser owner (scripts/db/migration-
// job.mjs), so with CI_MIGRATION_OWNER set, provision as one: a migration that
// only a superuser can apply then fails here instead of on the next deploy.
// CI_POSTGRES_USER must be the superuser that creates the owner.
const owner = process.env.CI_MIGRATION_OWNER;
const ownerPassword = process.env.CI_MIGRATION_OWNER_PASSWORD;
let target = url(user, password, database);
if (owner) {
  if (!ownerPassword) {
    console.error("CI_MIGRATION_OWNER_PASSWORD is required with CI_MIGRATION_OWNER");
    process.exit(1);
  }
  const ownedDatabase = `${database}_owned`;
  const admin = new Client({ connectionString: url(user, password, database) });
  await admin.connect();
  try {
    await admin.query(
      `CREATE ROLE ${admin.escapeIdentifier(owner)} LOGIN NOSUPERUSER CREATEROLE NOBYPASSRLS NOCREATEDB PASSWORD ${admin.escapeLiteral(ownerPassword)}`,
    );
    await admin.query(
      `CREATE DATABASE ${admin.escapeIdentifier(ownedDatabase)} OWNER ${admin.escapeIdentifier(owner)}`,
    );
  } finally {
    await admin.end();
  }
  target = url(owner, ownerPassword, ownedDatabase);
  console.log(`Provisioning ${ownedDatabase} as ${owner}, a non-superuser owner.`);
}
process.env.DATABASE_URL = target;

// Provision rather than bare `migrate deploy`: migrations depend on helper
// functions created by sql/setup (migration 098 calls app.reject_update_delete),
// so `migrate deploy` alone fails on a clean database.
const steps = ["node scripts/db/provision-database.mjs"];
// A deploy reruns the whole sequence on the provisioned database (the
// migration job's release mode), so prove it is idempotent too.
if (owner) steps.push("node scripts/db/provision-database.mjs --release");
steps.push("node scripts/guards/check-migrate-status.mjs");
for (const step of steps) {
  execSync(step, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}
