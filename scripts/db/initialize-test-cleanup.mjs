import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { parseDisposableDatabaseUrl, UUID } from "./test-cleanup-boundary.mjs";

export async function initializeTestCleanup(env = process.env) {
  if (env.TEST_DATABASE_DISPOSABLE !== "1")
    throw new Error("TEST_DATABASE_DISPOSABLE=1 is required for explicit initialization.");
  const target = parseDisposableDatabaseUrl(env.TEST_DATABASE_BOOTSTRAP_URL);
  if (!UUID.test(env.TEST_DATABASE_ID ?? "")) throw new Error("TEST_DATABASE_ID must be a UUID.");
  if ((env.TEST_CLEANUP_PASSWORD ?? "").length < 16)
    throw new Error("A separate TEST_CLEANUP_PASSWORD of at least 16 characters is required.");
  const client = new Client({
    connectionString: env.TEST_DATABASE_BOOTSTRAP_URL,
    options: "",
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    const actual = (await client.query("SELECT current_database() AS name")).rows[0].name;
    if (actual !== target.database) throw new Error("Bootstrap database identity mismatch.");
    // Never mark an existing populated application database as disposable.
    if (
      (
        await client.query(
          "SELECT (SELECT count(*) FROM public.tenants) + (SELECT count(*) FROM public.auth_principals) AS n",
        )
      ).rows[0].n !== "0"
    )
      throw new Error("Initialize cleanup only on an empty, newly provisioned test database.");
    const exists = (
      await client.query("SELECT to_regclass('atlas_test_cleanup.database_identity') AS marker")
    ).rows[0].marker;
    if (exists) {
      const marker = (
        await client.query(
          "SELECT database_id::text FROM atlas_test_cleanup.database_identity WHERE singleton",
        )
      ).rows[0];
      if (marker?.database_id !== env.TEST_DATABASE_ID)
        throw new Error("Refusing to replace a different disposable database marker.");
    }
    const password = (
      await client.query("SELECT quote_literal($1) AS password", [env.TEST_CLEANUP_PASSWORD])
    ).rows[0].password;
    await client.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='atlas_test_cleanup') THEN CREATE ROLE atlas_test_cleanup; END IF; END $$`,
    );
    await client.query(
      `ALTER ROLE atlas_test_cleanup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS PASSWORD ${password}`,
    );
    await client.query(
      readFileSync(
        resolve(import.meta.dirname, "../../backend/prisma/sql/test-only/cleanup-registry.sql"),
        "utf8",
      ),
    );
    await client.query(
      `INSERT INTO atlas_test_cleanup.database_identity(singleton,database_id,database_name,purpose)
      VALUES(true,$1::uuid,current_database(),'disposable-tests-only') ON CONFLICT(singleton) DO NOTHING`,
      [env.TEST_DATABASE_ID],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  initializeTestCleanup()
    .then(() => console.log("Disposable cleanup identity and ownership hooks initialized."))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
