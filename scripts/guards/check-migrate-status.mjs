import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Post F-1 monorepo split these live under backend/, not the repo root.
const migrationsDir = join(repoRoot, "backend", "prisma", "migrations");
const prismaConfig = join("backend", "prisma.config.ts");

function listMigrationDirectories() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

if (!existsSync(migrationsDir)) {
  console.error(`Migration status check FAILED: no migrations directory at ${migrationsDir}.`);
  console.error("If migrations moved again, update scripts/guards/check-migrate-status.mjs.");
  process.exit(1);
}

if (!existsSync(join(repoRoot, prismaConfig))) {
  console.error(`Migration status check FAILED: missing ${prismaConfig}.`);
  process.exit(1);
}

const migrationDirectories = listMigrationDirectories();

// A guard that cannot find its input must fail, never skip. This previously
// pointed at the pre-restructure path, silently returned [] and exited 0 —
// so migration drift went undetected for the whole life of the check.
if (migrationDirectories.length === 0) {
  console.error(`Migration status check FAILED: ${migrationsDir} contains no migrations.`);
  process.exit(1);
}

console.log(`Checking migrate status for ${migrationDirectories.length} migrations...`);

try {
  const options = { cwd: repoRoot, stdio: "inherit", env: process.env };
  if (process.env.DATABASE_URL) {
    // The Prisma CLI with the current Node: the migration image has no pnpm.
    const { prismaCli } = await import("../db/prisma-cli.mjs");
    execFileSync(
      process.execPath,
      [prismaCli, "migrate", "status", "--config", prismaConfig],
      options,
    );
  } else {
    execSync(
      `pnpm exec dotenv -e .env.local -- prisma migrate status --config ${prismaConfig}`,
      options,
    );
  }
} catch {
  console.error("\nMigration status check FAILED: database schema is not up to date.");
  process.exit(1);
}
