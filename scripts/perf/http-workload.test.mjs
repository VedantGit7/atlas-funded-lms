import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateConfig, summarize, requestJson, runWorkload } from "./http-workload.mjs";

test("a rejected CLI run invalidates old successful evidence", () => {
  const folder = mkdtempSync(join(tmpdir(), "atlas-f17-"));
  const configPath = join(folder, "config.json");
  const outputPath = join(folder, "result.json");
  try {
    writeFileSync(configPath, "invalid-private-config");
    writeFileSync(outputPath, JSON.stringify({ passed: true }));
    const run = spawnSync(
      process.execPath,
      ["scripts/perf/http-workload.mjs", configPath, outputPath],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(readFileSync(outputPath, "utf8")).passed, false);
    assert.equal(run.stderr.includes("invalid-private-config"), false);
  } finally {
    unlinkSync(configPath);
    unlinkSync(outputPath);
    rmdirSync(folder);
  }
});

const config = () => ({
  mode: "local-smoke",
  origin: "http://fundedbeyond.localhost:3100",
  build: "development",
  phases: [
    { name: "warmup", users: 1, seconds: 1 },
    { name: "sustained", users: 2, seconds: 1 },
    { name: "burst", users: 2, seconds: 1 },
  ],
  pacingMs: 100,
  timeoutMs: 1000,
  fixture: { courseId: "course", lessonId: "lesson", positionSeconds: 30 },
  users: [
    { email: "one@test", password: "secret" },
    { email: "two@test", password: "secret" },
  ],
});

test("rejects unsafe targets, duplicate actors, invalid phases, and missing build provenance", () => {
  assert.doesNotThrow(() => validateConfig(config()));
  for (const patch of [
    { origin: "https://example.com" },
    { origin: "http://fundedbeyond.localhost:3000" },
    { origin: "http://user:pass@fundedbeyond.localhost:3100" },
    { pacingMs: -1 },
    { timeoutMs: Infinity },
    { build: "" },
    { users: [config().users[0], config().users[0]] },
    { phases: [] },
    { phases: [{ name: "sustained", users: 9999, seconds: 1 }] },
  ])
    assert.throws(() => validateConfig({ ...config(), ...patch }));
  assert.throws(() =>
    validateConfig({ ...config(), mode: "staging", origin: "https://staging.example.com" }),
  );
});

test("empty samples are unavailable, and failed requests remain in error and all-attempt counts", () => {
  assert.equal(summarize([]).successLatencyMs, null);
  const stats = summarize([
    { ms: 1, ok: true, status: 200 },
    { ms: 10, ok: true, status: 200 },
    { ms: 100, ok: false, status: 429 },
  ]);
  assert.equal(stats.attempts, 3);
  assert.equal(stats.errors, 1);
  assert.equal(stats.successLatencyMs.p95, 10);
  assert.equal(stats.allAttemptLatencyMs.p99, 100);
});

test("HTTP includes body download, rejects redirects and wrong successful payloads, never returns response secrets", async () => {
  let redirected = 0;
  const server = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/secret" });
      res.end();
    } else if (req.url === "/secret") {
      redirected++;
      res.end("secret");
    } else if (req.url === "/slow") {
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"data":');
      setTimeout(() => res.end('{"ok":true}}'), 60);
    } else {
      res.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": "atlas-access-token=private; Path=/",
      });
      res.end('{"data":{"ok":false,"secret":"private"}}');
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const jar = new Map();
    assert.equal(
      (await requestJson({ origin, path: "/redirect", jar, timeoutMs: 1000 })).ok,
      false,
    );
    assert.equal(redirected, 0);
    const wrong = await requestJson({
      origin,
      path: "/wrong",
      jar,
      timeoutMs: 1000,
      check: (body) => body.data.ok === true,
    });
    assert.equal(wrong.ok, false);
    assert.equal(JSON.stringify(wrong).includes("private"), false);
    const slow = await requestJson({
      origin,
      path: "/slow",
      jar,
      timeoutMs: 1000,
      check: (body) => body.data.ok,
    });
    assert.equal(slow.ok, true);
    assert.ok(slow.ms >= 50);
    assert.equal((await requestJson({ origin, path: "/slow", jar, timeoutMs: 10 })).ok, false);
    await assert.rejects(requestJson({ origin, path: "//elsewhere.test/", jar, timeoutMs: 1000 }));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("distinct users, warmup exclusion and errors are preserved in a bounded full runner", async () => {
  const seen = new Set();
  const result = await runWorkload(config(), {
    request: async ({ path, body }) => {
      if (path.endsWith("/login")) seen.add(body.email);
      return {
        ms: 2,
        ok: !path.endsWith("/progress"),
        status: path.endsWith("/progress") ? 429 : 200,
        reason: path.endsWith("/progress") ? "http-status" : null,
      };
    },
  });
  assert.equal(seen.size, 2);
  assert.equal(result.phases.length, 3);
  assert.equal(result.phases[0].includedInSizing, false);
  assert.ok(result.phases[1].requests.errors > 0);
  assert.equal(result.capacityVerified, false);
  assert.equal(result.telemetry.workerLagMs, null);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(JSON.stringify(result).includes("one@test"), false);
});

test("phase boundaries stop scheduling requests and record incomplete journeys", async () => {
  let phaseStarted = 0;
  const starts = [];
  const c = config();
  c.phases.forEach((p) => {
    p.users = 1;
  });
  const result = await runWorkload(c, {
    request: async ({ path }) => {
      if (path.endsWith("/refresh")) phaseStarted = performance.now();
      if (!path.endsWith("/login") && !path.endsWith("/enrollments")) {
        starts.push(performance.now() - phaseStarted);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return { ms: 400, ok: true, status: 200, reason: null };
    },
  });
  assert.ok(starts.every((start) => start < 1050));
  assert.ok(result.phases.every((p) => p.incompleteJourneys > 0));
  assert.equal(result.passed, false); // No complete journey is not a performance pass.
});
