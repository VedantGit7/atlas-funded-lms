/** Seeding is deliberately restricted to disposable local databases and auth. */
export function assertIsolatedFixtureTarget({ databaseUrl, authUrl }) {
  const database = new URL(databaseUrl);
  const auth = new URL(authUrl);
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    !loopback.has(database.hostname) ||
    [...database.searchParams].some(([key, value]) => key !== "schema" || value !== "public") ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !["/atlas_lms_e2e", "/atlas_lms_ci"].includes(database.pathname)
  ) {
    throw new Error("Browser fixtures require a local atlas_lms_e2e or atlas_lms_ci database.");
  }
  if (!loopback.has(auth.hostname) || auth.protocol !== "http:" || auth.pathname !== "/") {
    throw new Error("Browser fixtures require local HTTP auth at its root URL.");
  }
}
