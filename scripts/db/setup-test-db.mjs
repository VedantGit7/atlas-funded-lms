import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseDisposableDatabaseUrl, UUID } from "./test-cleanup-boundary.mjs";
import { initializeTestCleanup } from "./initialize-test-cleanup.mjs";

// Fresh databases only. Never clone, terminate sessions, or drop an existing DB.
async function main() {
  if (process.env.TEST_DATABASE_DISPOSABLE !== "1")
    throw new Error(
      "TEST_DATABASE_DISPOSABLE=1 is required; see docs/runbooks/test-database-cleanup.md.",
    );
  parseDisposableDatabaseUrl(process.env.TEST_DATABASE_BOOTSTRAP_URL);
  if (
    !UUID.test(process.env.TEST_DATABASE_ID ?? "") ||
    (process.env.TEST_CLEANUP_PASSWORD ?? "").length < 16
  )
    throw new Error(
      "Set TEST_DATABASE_ID (UUID) and a separate TEST_CLEANUP_PASSWORD (16+ characters).",
    );
  const repoRoot = resolve(import.meta.dirname, "../..");
  const childEnv = {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_BOOTSTRAP_URL,
    PLATFORM_DATABASE_URL: process.env.TEST_DATABASE_BOOTSTRAP_URL,
    PGOPTIONS: "",
  };
  // Do not let alternate inherited application/admin URLs redirect provisioning.
  for (const key of ["DIRECT_DATABASE_URL", "DATABASE_DIRECT_URL", "TEST_CLEANUP_DATABASE_URL"])
    delete childEnv[key];
  execFileSync(process.execPath, ["scripts/db/provision-database.mjs"], {
    cwd: repoRoot,
    env: childEnv,
    stdio: "inherit",
  });
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "backend/prisma/seeds/index.ts", "catalogues", "--apply"],
    { cwd: repoRoot, env: childEnv, stdio: "inherit" },
  );
  await initializeTestCleanup();
  console.log("Fresh disposable test database provisioned and cleanup identity initialized.");
}
main().catch(() => {
  console.error(
    "[setup-test-db] refused or failed. Check the explicit disposable configuration and preceding diagnostic; existing databases are never reset.",
  );
  process.exitCode = 1;
});
