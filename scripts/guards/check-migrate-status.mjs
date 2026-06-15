import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = join(repoRoot, "prisma", "migrations");

function listMigrationDirectories() {
  try {
    return readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

const migrationDirectories = listMigrationDirectories();

if (migrationDirectories.length === 0) {
  console.log("Migration status check skipped: no migrations yet (Sprint 0 Prisma baseline).");
  process.exit(0);
}

execSync("dotenv -e .env.local -- prisma migrate status", {
  cwd: repoRoot,
  stdio: "inherit",
});
