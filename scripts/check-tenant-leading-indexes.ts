import { Client } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    console.error("DATABASE_URL is required for db:tenant-indexes:check");
    process.exit(1);
  }

  const sql = `
WITH tenant_tables AS (
  SELECT c.oid, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN information_schema.columns col
    ON col.table_schema = n.nspname
   AND col.table_name = c.relname
   AND col.column_name = 'tenant_id'
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
),
leading_tenant_indexes AS (
  SELECT DISTINCT t.relname
  FROM tenant_tables t
  JOIN pg_index i ON i.indrelid = t.oid
  JOIN pg_attribute a
    ON a.attrelid = t.oid
   AND a.attnum = i.indkey[0]
  WHERE a.attname = 'tenant_id'
)
SELECT relname
FROM tenant_tables
WHERE relname NOT IN (SELECT relname FROM leading_tenant_indexes)
ORDER BY relname;
`;

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query<{ relname: string }>(sql);
    const failures = result.rows.map((row) => row.relname);

    if (failures.length > 0) {
      console.error("Tenant tables missing tenant-leading indexes:");
      for (const tableName of failures) {
        console.error(tableName);
      }
      process.exit(1);
    }

    console.log("PASS: all tenant tables have at least one tenant-leading index.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
