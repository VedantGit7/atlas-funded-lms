import { Client } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    console.error("DATABASE_URL is required for db:rls:check");
    process.exit(1);
  }

  const sql = `
WITH tenant_tables AS (
  SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN information_schema.columns col
    ON col.table_schema = n.nspname
   AND col.table_name = c.relname
   AND col.column_name = 'tenant_id'
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
)
SELECT relname
FROM tenant_tables
WHERE relrowsecurity IS NOT TRUE
   OR relforcerowsecurity IS NOT TRUE
ORDER BY relname;
`;

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query<{ relname: string }>(sql);
    const failures = result.rows.map((row) => row.relname);

    if (failures.length > 0) {
      console.error("RLS is not enabled/forced on these tenant tables:");
      for (const tableName of failures) {
        console.error(tableName);
      }
      process.exit(1);
    }

    console.log("PASS: RLS is enabled and forced on all tenant_id tables.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
