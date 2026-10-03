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

test("streaming collection skips oversized lines across chunks and keeps only the latest sanitized process snapshots", async () => {
  const { poolEvidenceFromFile } = await import("./telemetry.mjs");
  assert.equal(typeof poolEvidenceFromFile, "function");
  const { mkdtempSync, writeFileSync, appendFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "atlas-pool-log-"));
  const path = join(directory, "process.log");
  const measurement = {
    count: 1,
    errors: 0,
    totalMs: 1,
    maxMs: 1,
    inFlight: 0,
    buckets: [{ upperBoundMs: 1, count: 1 }],
  };
  const record = {
    event: "db_pool_metrics",
    pool: "tenant",
    pid: 123,
    uptimeMs: 60000,
    acquisition: measurement,
    query: measurement,
    connections: { total: 1, idle: 1, waiting: 0 },
    secret: "must-not-export",
  };
  try {
    writeFileSync(path, JSON.stringify(record) + "\r\n");
    // The oversized line starts like telemetry, but its tail must never become
    // a separate record. This exercises dozens of file-read chunk boundaries.
    appendFileSync(
      path,
      JSON.stringify({ ...record, uptimeMs: 999999, secret: "x".repeat(2 * 1024 * 1024) }) + "\n",
    );
    appendFileSync(path, JSON.stringify({ ...record, uptimeMs: 120000 }) + "\r\n");
    appendFileSync(path, JSON.stringify({ ...record, pool: "usage", pid: 456 }) + "\n");
    appendFileSync(path, '{"event":"db_pool_metrics","secret":"unfinished');
    const result = await poolEvidenceFromFile(path);
    assert.equal(result.length, 2);
    assert.equal(result[0].uptimeMs, 120000);
    assert.deepEqual(
      result,
      poolEvidence(
        [
          JSON.stringify({ ...record, uptimeMs: 120000 }),
          JSON.stringify({ ...record, pool: "usage", pid: 456 }),
        ].join("\n"),
      ),
    );
    assert.equal(JSON.stringify(result).includes("must-not-export"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("streaming collection fails explicitly rather than retaining unbounded process identities", async () => {
  const { poolEvidenceFromFile } = await import("./telemetry.mjs");
  assert.equal(typeof poolEvidenceFromFile, "function");
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "atlas-pool-limit-"));
  const path = join(directory, "process.log");
  const measurement = { count: 0, errors: 0, totalMs: 0, maxMs: 0, inFlight: 0, buckets: [] };
  try {
    writeFileSync(
      path,
      Array.from({ length: 257 }, (_, pid) =>
        JSON.stringify({
          event: "db_pool_metrics",
          pool: "tenant",
          pid,
          uptimeMs: 1,
          acquisition: measurement,
          query: measurement,
          connections: { total: 0, idle: 0, waiting: 0 },
        }),
      ).join("\n"),
    );
    await assert.rejects(poolEvidenceFromFile(path), /Too many process pool identities/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
