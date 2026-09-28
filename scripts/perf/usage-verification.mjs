import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { localEnv } from "../e2e/local-env.mjs";
import { assertCapacityTarget } from "./capacity-fixture.mjs";

const operationNames = ["course", "lesson", "progress-save", "progress-read"];
function count(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Missing or invalid usage evidence count");
  return value;
}

/** Bounds deliberately disclose that a cancelled/failed HTTP request can still be metered. */
export function reconcileUsage(before, after, report) {
  if (!before.tenantId || before.tenantId !== after.tenantId || !report.phases?.length)
    throw new Error("Compatible snapshots and a complete workload report are required");
  const enrollment = report.setupByOperation?.enrollment;
  let minimum = count(enrollment?.attempts) - count(enrollment?.errors);
  let maximum = count(enrollment?.attempts);
  for (const phase of report.phases) {
    maximum += count(phase.cancelledRequests);
    for (const operation of operationNames) {
      const metrics = phase.byOperation?.[operation];
      minimum += count(metrics?.attempts) - count(metrics?.errors);
      maximum += count(metrics?.attempts);
    }
  }
  const delta = count(after.journal.requests) - count(before.journal.requests);
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    durableRequestDelta: delta,
    minimumExpectedRequests: minimum,
    maximumExpectedRequests: maximum,
    withinExpectedBounds: delta >= minimum && delta <= maximum,
    exact: minimum === maximum && delta === minimum,
    limitations:
      "Requires snapshots around the full workload including enrollment setup, no unrelated tenant traffic or journal pruning, and completed server work before the final snapshot. Errors and cancellations create count uncertainty. Combine with terminal failure logs and acknowledgement counters; HTTP success alone does not establish durability.",
  };
}

export async function snapshotLocalUsage() {
  const env = localEnv();
  assertCapacityTarget({
    databaseUrl: env.DATABASE_URL,
    authUrl: env.SUPABASE_URL,
    acknowledged: true,
  });
  const fixture = JSON.parse(readFileSync(env.E2E_SCENARIO_PATH, "utf8"));
  if (!/^[0-9a-f-]{36}$/i.test(fixture.tenantId))
    throw new Error("Missing isolated tenant fixture");
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
  });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL ROLE atlas_app");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [fixture.tenantId]);
    const journal = await client.query(`SELECT count(*)::float8 AS events,
      coalesce(sum(requests),0)::float8 AS requests, coalesce(sum(emails),0)::float8 AS emails,
      count(*) FILTER (WHERE processed_at IS NULL)::float8 AS pending
      FROM tenant_usage_events`);
    const rollup =
      await client.query(`SELECT coalesce(sum((metrics_json->>'count')::numeric),0)::float8 AS requests
      FROM analytics_rollups WHERE rollup_key='usage.api_requests'`);
    await client.query("COMMIT");
    return {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      tenantId: fixture.tenantId,
      journal: journal.rows[0],
      rollupRequests: rollup.rows[0].requests,
    };
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    let result;
    let output;
    if (mode === "snapshot" && args.length === 1) {
      output = args[0];
      result = await snapshotLocalUsage();
    } else if (mode === "reconcile" && args.length === 4) {
      result = reconcileUsage(
        ...args.slice(0, 3).map((file) => JSON.parse(readFileSync(file, "utf8"))),
      );
      output = args[3];
      if (!result.withinExpectedBounds) process.exitCode = 1;
    } else
      throw new Error(
        "Usage: usage-verification.mjs snapshot <output.json> | reconcile <before.json> <after.json> <workload.json> <output.json>",
      );
    if (mode === "reconcile" && args.slice(0, 3).some((file) => resolve(file) === resolve(output)))
      throw new Error("Evidence output must not replace an input");
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result));
  } catch {
    // Connection errors can embed connection credentials.
    console.error(
      "Usage evidence failed; check isolated fixture readiness and input/output paths.",
    );
    process.exitCode = 1;
  }
}
