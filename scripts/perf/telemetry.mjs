import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { localEnv, ownerUrl } from "../e2e/local-env.mjs";
import { assertIsolatedFixtureTarget } from "../e2e/isolated-target.mjs";

const finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
function timing(value) {
  if (
    !value ||
    ![value.count, value.errors, value.totalMs, value.maxMs, value.inFlight].every(finite) ||
    !Array.isArray(value.buckets)
  )
    return null;
  const buckets = value.buckets.map((b) => ({ upperBoundMs: b.upperBoundMs, count: b.count }));
  if (
    buckets.some((b) => !(b.upperBoundMs === null || finite(b.upperBoundMs)) || !finite(b.count)) ||
    buckets.reduce((sum, b) => sum + b.count, 0) !== value.count
  )
    return null;
  const bound = (p) => {
    if (!value.count) return null;
    let sum = 0;
    for (const b of buckets) {
      sum += b.count;
      if (sum >= Math.ceil(p * value.count)) return b.upperBoundMs;
    }
    return null;
  };
  return {
    count: value.count,
    errors: value.errors,
    meanMs: value.count ? value.totalMs / value.count : null,
    maxMs: value.count ? value.maxMs : null,
    inFlight: value.inFlight,
    percentileUpperBoundsMs: { p50: bound(0.5), p95: bound(0.95), p99: bound(0.99) },
    buckets,
  };
}

/** Only allowlisted measurements enter evidence; no raw log line or SQL is exported. */
export function poolEvidence(log) {
  const latest = new Map();
  for (const line of log.split(/\r?\n/)) {
    if (!line.startsWith('{"event":"db_pool_metrics"')) continue;
    try {
      const record = JSON.parse(line);
      if (
        !["tenant", "platform", "usage"].includes(record.pool) ||
        !finite(record.pid) ||
        !finite(record.uptimeMs)
      )
        continue;
      const acquisition = timing(record.acquisition);
      const query = timing(record.query);
      const c = record.connections;
      if (!acquisition || !query || !c || ![c.total, c.idle, c.waiting].every(finite)) continue;
      latest.set(`${record.pid}:${record.pool}`, {
        pool: record.pool,
        pid: record.pid,
        capturedAt:
          typeof record.capturedAt === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.capturedAt)
            ? record.capturedAt
            : null,
        uptimeMs: record.uptimeMs,
        acquisition,
        query,
        connections: { total: c.total, idle: c.idle, waiting: c.waiting },
      });
    } catch {
      /* Ignore incomplete writes and unrelated lines. */
    }
  }
  return [...latest.values()];
}

export async function collectLocalTelemetry(logPaths) {
  const env = localEnv();
  assertIsolatedFixtureTarget({ databaseUrl: ownerUrl, authUrl: env.SUPABASE_URL });
  const fixture = JSON.parse(readFileSync(env.E2E_SCENARIO_PATH, "utf8"));
  if (!/^[\da-f-]{36}$/i.test(fixture.tenantId))
    throw new Error("Missing disposable tenant fixture");
  const pools = logPaths.flatMap((path) => poolEvidence(readFileSync(path, "utf8")));
  const client = new pg.Client({ connectionString: ownerUrl, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5s'");
    const {
      rows: [worker],
    } = await client.query(
      `SELECT
      count(*) FILTER (WHERE status IN ('pending','retry','processing'))::int AS "unfinishedJobs",
      count(*) FILTER (WHERE status IN ('pending','retry','processing') AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now()))::int AS "runnableJobs",
      COALESCE(max(extract(epoch FROM (now() - next_attempt_at)) * 1000) FILTER (WHERE status IN ('pending','retry','processing') AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now())),0)::float8 AS "oldestRunnableLagMs"
      FROM outbox_delivery_jobs WHERE tenant_id = $1::uuid`,
      [fixture.tenantId],
    );
    const {
      rows: [database],
    } = await client.query(
      "SELECT current_setting('max_connections')::int AS \"maxConnections\", current_setting('server_version') AS version",
    );
    await client.query("COMMIT");
    return {
      capturedAt: new Date().toISOString(),
      mode: "local-smoke",
      pools,
      poolScope:
        "Latest cumulative process snapshots from supplied logs, not phase-isolated deltas. Histogram bounds are not exact percentiles; null means absent or above largest finite bucket.",
      worker: {
        ...worker,
        workerExecutionVerified: false,
        scope:
          "Point-in-time materialized delivery jobs for the fixture tenant only. Does not prove worker processing or measure jobs not yet materialized.",
      },
      database,
      capacityVerified: false,
    };
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const paths = process.argv.slice(2);
    if (!paths.length) throw new Error("Supply test process log paths");
    const result = await collectLocalTelemetry(paths);
    mkdirSync(".test-results/f17", { recursive: true });
    writeFileSync(".test-results/f17/telemetry-local.json", `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      JSON.stringify({
        poolSnapshots: result.pools.length,
        worker: result.worker,
        capacityVerified: false,
      }),
    );
  } catch {
    console.error(
      "Local telemetry unavailable; check disposable fixture services and local log paths.",
    );
    process.exitCode = 1;
  }
}
