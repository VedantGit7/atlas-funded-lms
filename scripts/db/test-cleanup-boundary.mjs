import { Client } from "pg";

export const CLEANUP_ROLE = "atlas_test_cleanup";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const databases = new Set(["atlas_lms_test", "atlas_lms_ci"]);

export function parseDisposableDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid disposable PostgreSQL database URL is required.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !databases.has(url.pathname.slice(1)) ||
    !url.username ||
    !url.password ||
    url.hash ||
    [...url.searchParams].some(([key, value]) => key !== "schema" || value !== "public")
  ) {
    throw new Error(
      "Test cleanup requires a loopback disposable atlas_lms_test or atlas_lms_ci database without connection overrides.",
    );
  }
  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
  };
}

export function assertSameTarget(left, right) {
  const a = parseDisposableDatabaseUrl(left),
    b = parseDisposableDatabaseUrl(right);
  if (a.host !== b.host || a.port !== b.port || a.database !== b.database)
    throw new Error(
      "Test and cleanup connections must use the same explicit host, port and database.",
    );
  if (a.user === CLEANUP_ROLE)
    throw new Error("Application tests must not use cleanup credentials.");
}

export function cleanupConfiguration(env = process.env) {
  if (!env.TEST_CLEANUP_DATABASE_URL)
    throw new Error(
      "TEST_CLEANUP_DATABASE_URL is required; DATABASE_URL is never a cleanup credential.",
    );
  if (env.ALLOW_DESTRUCTIVE_TEST_CLEANUP !== "1")
    throw new Error("ALLOW_DESTRUCTIVE_TEST_CLEANUP=1 is required.");
  if (!UUID.test(env.TEST_DATABASE_ID ?? ""))
    throw new Error("TEST_DATABASE_ID must identify the initialized disposable database.");
  const target = parseDisposableDatabaseUrl(env.TEST_CLEANUP_DATABASE_URL);
  if (target.user !== CLEANUP_ROLE)
    throw new Error("Cleanup must connect using the separate atlas_test_cleanup role.");
  return { target, databaseUrl: env.TEST_CLEANUP_DATABASE_URL, databaseId: env.TEST_DATABASE_ID };
}

export function cleanupClient(config) {
  // Override PGOPTIONS explicitly: cleanup does not act as a fixture writer.
  return new Client({
    connectionString: config.databaseUrl,
    options: "",
    connectionTimeoutMillis: 5000,
  });
}

export async function assertDatabaseIdentity(client, config) {
  const { rows } = await client.query(`SELECT current_database() AS database, session_user AS login,
    current_user AS role, inet_server_port() AS server_port,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser`);
  const row = rows[0];
  if (
    row?.database !== config.target.database ||
    row.login !== CLEANUP_ROLE ||
    row.role !== CLEANUP_ROLE ||
    row.superuser
  )
    throw new Error(
      "Cleanup connection identity does not match the disposable database and non-superuser cleanup role.",
    );
  const marker = await client.query(
    `SELECT database_id::text, database_name, purpose FROM atlas_test_cleanup.database_identity WHERE singleton = true`,
  );
  if (
    marker.rows.length !== 1 ||
    marker.rows[0].database_id !== config.databaseId ||
    marker.rows[0].database_name !== row.database ||
    marker.rows[0].purpose !== "disposable-tests-only"
  )
    throw new Error("Disposable database marker is missing or mismatched; refusing cleanup.");
}
