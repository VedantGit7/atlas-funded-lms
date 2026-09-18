import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

process.env.DATABASE_URL = [
  "postgresql:",
  "//",
  user,
  ":",
  password,
  "@",
  "localhost:5432/",
  database,
  "?schema=public",
].join("");

// Provision rather than bare `migrate deploy`: migrations depend on helper
// functions created by sql/setup (migration 098 calls app.reject_update_delete),
// so `migrate deploy` alone fails on a clean database.
execSync("node scripts/db/provision-database.mjs", {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

execSync("node scripts/guards/check-migrate-status.mjs", {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
