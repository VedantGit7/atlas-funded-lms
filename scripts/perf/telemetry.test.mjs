import test from "node:test";
import assert from "node:assert/strict";
import { poolEvidence } from "./telemetry.mjs";
test("missing pool samples are unavailable, and only safe aggregate fields survive", () => {
  assert.deepEqual(poolEvidence("unrelated log"), []);
  const measurement = {
    count: 2,
    errors: 0,
    totalMs: 11,
    maxMs: 10,
    inFlight: 0,
    buckets: [
      { upperBoundMs: 1, count: 1 },
      { upperBoundMs: 10, count: 1 },
      { upperBoundMs: null, count: 0 },
    ],
  };
  const record = {
    event: "db_pool_metrics",
    pool: "tenant",
    pid: 1,
    capturedAt: "2026-09-20T00:00:00.000Z",
    uptimeMs: 60000,
    acquisition: measurement,
    query: measurement,
    connections: { total: 1, idle: 1, waiting: 0 },
    secret: "must-not-export",
  };
  const result = poolEvidence(
    [
      "private raw SQL",
      JSON.stringify(record),
      JSON.stringify({ ...record, uptimeMs: 120000 }),
    ].join("\n"),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].uptimeMs, 120000);
  assert.equal(result[0].query.percentileUpperBoundsMs.p95, 10);
  assert.equal(JSON.stringify(result).includes("must-not-export"), false);
  assert.equal(
    poolEvidence(JSON.stringify({ ...record, query: { ...measurement, count: -1 } })).length,
    0,
  );
  const usage = poolEvidence(JSON.stringify({ ...record, pool: "usage" }));
  assert.equal(usage.length, 1);
  assert.equal(usage[0].pool, "usage");
  assert.equal(JSON.stringify(usage).includes("must-not-export"), false);
  assert.deepEqual(poolEvidence(JSON.stringify({ ...record, pool: "unknown" })), []);
});
