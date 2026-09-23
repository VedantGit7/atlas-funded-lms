import { Client } from "pg";
import { PROTECTED_TENANT_SLUGS, TEST_TENANT_SLUG_REGEX } from "./test-tenant-slugs.mjs";

/**
 * CI / gate guard: fails if any automated-test tenants have leaked into the
 * database. Combined with the vitest global teardown, this turns silent
 * multi-week accumulation of throwaway tenants into an immediate red build.
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[check-no-leaked-test-tenants] DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  const result = await client.query(
    `select slug, count(*) over ()::int as total
       from tenants
      where slug ~ $1
        and slug <> all($2::text[])
      order by created_at asc
      limit 10`,
    [TEST_TENANT_SLUG_REGEX, PROTECTED_TENANT_SLUGS],
  );

  const total = result.rows[0]?.total ?? 0;

  if (total === 0) {
    console.log("[check-no-leaked-test-tenants] ok: no leaked test tenants found.");
    process.exit(0);
  }

  console.error(`[check-no-leaked-test-tenants] FAILED: ${total} leaked test tenant(s) found.`);
  console.error("  sample slugs:", result.rows.map((row) => row.slug).join(", "));
  console.error(
    "  Inspect fixture ownership and the failed test run's UUID before cleanup. " +
      "Guarded cleanup requires dedicated test credentials, explicit opt-in, and " +
      "`pnpm db:cleanup-test-tenants --run-id <UUID>` for a dry run. " +
      "Legacy rows without run ownership require separate review; slug matches do not authorize deletion.",
  );
  process.exit(1);
} finally {
  await client.end();
}
