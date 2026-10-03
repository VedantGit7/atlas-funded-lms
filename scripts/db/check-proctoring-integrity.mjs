import { Client } from "pg";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function checkProctoringIntegrity(databaseUrl) {
  if (!databaseUrl)
    throw new Error(
      "PROCTORING_INTEGRITY_DATABASE_URL must explicitly select the database to inspect.",
    );
  const client = new Client({
    connectionString: databaseUrl,
    options: "",
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    // Never mistake an RLS-filtered view for a globally clean database.
    await client.query(
      "SET LOCAL row_security=off; SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='5s'",
    );
    const identity = (
      await client.query(`SELECT current_database() AS database,
      (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS complete_visibility`)
    ).rows[0];
    if (!identity.complete_visibility)
      throw new Error(
        "Use a read-authorized owner/admin login with complete RLS visibility for this aggregate integrity check.",
      );
    const counts = (
      await client.query(`SELECT
      (SELECT count(*)::int FROM public.proctoring_media_artifacts) AS artifacts,
      (SELECT count(*)::int FROM public.proctoring_sessions) AS sessions,
      (SELECT count(*)::int FROM public.proctoring_events) AS events,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=a.tenant_id))::int AS missing_tenants,
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.proctoring_sessions s WHERE s.id=a.proctoring_session_id AND s.tenant_id=a.tenant_id))::int AS invalid_sessions,
      count(*) FILTER (WHERE a.proctoring_event_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.proctoring_events e WHERE e.id=a.proctoring_event_id
          AND e.tenant_id=a.tenant_id AND e.proctoring_session_id=a.proctoring_session_id))::int AS invalid_events
      FROM public.proctoring_media_artifacts a`)
    ).rows[0];
    const constraints = (
      await client.query(`SELECT conname AS name,convalidated AS validated,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid='public.proctoring_media_artifacts'::regclass AND contype='f' ORDER BY conname`)
    ).rows;
    const expected = [
      "proctoring_media_artifacts_tenant_fkey",
      "proctoring_media_artifacts_session_fkey",
      "proctoring_media_artifacts_event_fkey",
    ];
    return {
      database: identity.database,
      counts,
      clean:
        counts.missing_tenants === 0 &&
        counts.invalid_sessions === 0 &&
        counts.invalid_events === 0,
      validated: expected.every((name) => constraints.some((c) => c.name === name && c.validated)),
      constraints,
    };
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkProctoringIntegrity(process.env.PROCTORING_INTEGRITY_DATABASE_URL)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.clean || (process.argv.includes("--require-validated") && !report.validated))
        process.exitCode = 1;
    })
    .catch((error) => {
      console.error("[proctoring-integrity] check failed:", error.code ?? error.message);
      process.exitCode = 1;
    });
}
