/**
 * Seeding is deliberately restricted to disposable local databases. Login is
 * Better Auth, whose accounts live in that database (launch plan task 3.7), so
 * the database is the only target to check.
 */
export function assertIsolatedFixtureTarget({ databaseUrl }) {
  const database = new URL(databaseUrl);
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    !loopback.has(database.hostname) ||
    [...database.searchParams].some(([key, value]) => key !== "schema" || value !== "public") ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !["/atlas_lms_e2e", "/atlas_lms_ci"].includes(database.pathname)
  ) {
    throw new Error("Browser fixtures require a local atlas_lms_e2e or atlas_lms_ci database.");
  }
}
