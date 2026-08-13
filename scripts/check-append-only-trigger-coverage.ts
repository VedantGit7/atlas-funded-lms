import { Client } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    console.error("DATABASE_URL is required for db:append-only:check");
    process.exit(1);
  }

  const sql = `
WITH required_append_only(table_name) AS (
  VALUES
    ('tenant_branding_version'),
    ('tenant_theme_version'),
    ('tenant_config_version'),
    ('entitlement_grant_history'),
    ('outbox_events'),
    ('dead_letter_events'),
    ('audit_entries'),
    ('workflow_transitions'),
    ('attempt_answers'),
    ('proctoring_events'),
    ('practice_responses'),
    ('scoring_config_versions'),
    ('competency_signals'),
    ('competency_score_snapshots'),
    ('credential_verifications'),
    ('point_ledger'),
    ('notification_dispatches'),
    ('moderation_decisions'),
    ('automation_runs')
),
actual_triggers AS (
  SELECT event_object_table AS table_name
  FROM information_schema.triggers
  WHERE trigger_name LIKE '%append_only%'
)
SELECT r.table_name
FROM required_append_only r
LEFT JOIN actual_triggers a ON a.table_name = r.table_name
WHERE to_regclass('public.' || r.table_name) IS NOT NULL
  AND a.table_name IS NULL
ORDER BY r.table_name;
`;

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query<{ table_name: string }>(sql);
    const failures = result.rows.map((row) => row.table_name);

    if (failures.length > 0) {
      console.error("Append-only tables missing append_only triggers:");
      for (const tableName of failures) {
        console.error(tableName);
      }
      process.exit(1);
    }

    console.log("PASS: append-only trigger coverage is complete for required tables.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
