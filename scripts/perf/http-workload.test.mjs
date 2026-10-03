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
    writeFileSync(`${outputPath}.progress.jsonl`, '{"phase":"old-success"}\n');
    writeFileSync(`${outputPath}.progress.json`, '{"phase":"old-success"}\n');
    const run = spawnSync(
      process.execPath,
      ["scripts/perf/http-workload.mjs", configPath, outputPath],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(readFileSync(outputPath, "utf8")).passed, false);
    assert.equal(readFileSync(`${outputPath}.progress.jsonl`, "utf8"), "");
    assert.equal(
      JSON.parse(readFileSync(`${outputPath}.progress.json`, "utf8")).status,
      "incomplete",
    );
    assert.equal(run.stderr.includes("invalid-private-config"), false);
  } finally {
    unlinkSync(configPath);
    unlinkSync(outputPath);
    unlinkSync(`${outputPath}.progress.jsonl`);
    unlinkSync(`${outputPath}.progress.json`);
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
  drainMs: 100,
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
    { drainMs: -1 },
    { drainMs: 120001 },
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
  c.drainMs = 0;
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

test("bounded drain finishes admitted journeys without starting another journey after the load window", async () => {
  const c = { ...config(), drainMs: 1000, slo: { requestP95Ms: 1000, journeyP95Ms: 3000 } };
  c.phases.forEach((p) => {
    p.users = 1;
  });
  const result = await runWorkload(c, {
    request: async ({ path }) => {
      if (!path.endsWith("/login") && !path.endsWith("/enrollments") && !path.endsWith("/refresh"))
        await new Promise((resolve) => setTimeout(resolve, 250));
      return { ms: 250, ok: true, status: 200, reason: null };
    },
  });
  assert.equal(result.passed, true);
  assert.equal(result.performancePassed, true);
  for (const p of result.phases) {
    assert.equal(p.journeys.attempts, 1);
    assert.equal(p.incompleteJourneys, 0);
    assert.equal(p.cancelledRequests, 0);
    assert.equal(p.drainMs, 1000);
    assert.ok(p.drainElapsedMs >= 200 && p.drainElapsedMs < 1000);
    assert.ok(p.elapsedMs >= 1200);
  }
});

test("drain deadline cancels a stuck request and rejects capacity even after earlier journeys succeed", async () => {
  const c = { ...config(), drainMs: 100, slo: { requestP95Ms: 1000, journeyP95Ms: 3000 } };
  c.phases.forEach((p) => {
    p.users = 1;
  });
  let identities = 0;
  const result = await runWorkload(c, {
    request: async ({ path, signal }) => {
      if (path.endsWith("/refresh")) identities = 0;
      if (path.endsWith("/me") && ++identities === 2) {
        await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
        return { ms: 1000, ok: false, status: 0, reason: "phase-deadline" };
      }
      return { ms: 1, ok: true, status: 200, reason: null };
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.performancePassed, false);
  for (const p of result.phases) {
    assert.equal(p.journeys.attempts, 1);
    assert.equal(p.cancelledRequests, 1);
    assert.equal(p.incompleteJourneys, 1);
    assert.ok(p.elapsedMs >= 1090 && p.elapsedMs < 2000);
  }
});

test("a successful final response beyond the hard deadline cannot pass", async () => {
  const c = { ...config(), drainMs: 100, slo: { requestP95Ms: 2000, journeyP95Ms: 3000 } };
  c.phases.forEach((p) => {
    p.users = 1;
  });
  let reads = 0;
  const result = await runWorkload(c, {
    request: async ({ path }) => {
      if (path.endsWith("/refresh")) reads = 0;
      if (path.endsWith("/lessons/lesson") && ++reads === 2)
        await new Promise((resolve) => setTimeout(resolve, 1300));
      return { ms: 1300, ok: true, status: 200, reason: null };
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.performancePassed, false);
  assert.ok(result.phases.every((p) => p.deadlineOverruns === 1 && p.incompleteJourneys === 1));
});

test("refresh completing during drain cannot admit a journey", async () => {
  const c = { ...config(), drainMs: 1000 };
  c.phases.forEach((p) => {
    p.users = 1;
  });
  let identities = 0;
  const result = await runWorkload(c, {
    request: async ({ path }) => {
      if (path.endsWith("/refresh")) await new Promise((resolve) => setTimeout(resolve, 1100));
      if (path.endsWith("/me")) identities++;
      return { ms: 1100, ok: true, status: 200, reason: null };
    },
  });
  assert.equal(identities, 0);
  assert.equal(result.passed, false);
});

test("explicit disposable local endurance allows 200 actors and a real two-hour soak without sizing claims", () => {
  const c = {
    ...config(),
    mode: "local-endurance",
    build: "production-test-build",
    disposableFixtures: true,
    users: Array.from({ length: 200 }, (_, i) => ({
      email: `learner${i}@test`,
      password: "secret",
    })),
    phases: [
      { name: "warmup", users: 100, seconds: 120 },
      { name: "sustained", users: 100, seconds: 900 },
      { name: "burst", users: 200, seconds: 300 },
      { name: "endurance", users: 100, seconds: 7200 },
    ],
  };
  assert.doesNotThrow(() => validateConfig(c));
  for (const patch of [
    { disposableFixtures: false },
    { build: "" },
    { origin: "https://example.com" },
    { refreshIntervalMs: 999 },
    { refreshIntervalMs: 900001 },
    { phases: c.phases.map((p) => ({ ...p, seconds: 7201 })) },
  ])
    assert.throws(() => validateConfig({ ...c, ...patch }));
  assert.throws(() => validateConfig({ ...c, mode: "local-smoke" }));
});

test("streaming metrics retain every sample beyond the former 250000 cap with bounded storage", async () => {
  const { createSummary } = await import("./http-workload.mjs");
  assert.equal(typeof createSummary, "function");
  const summary = createSummary();
  const storage = summary.storageBins;
  for (let i = 0; i < 300001; i++)
    summary.add({ ms: i % 100, ok: i % 10 !== 0, status: i % 10 ? 200 : 429 });
  const result = summary.snapshot();
  assert.equal(result.attempts, 300001);
  assert.equal(result.errors, 30001);
  assert.equal(result.statuses[429], 30001);
  assert.ok(result.allAttemptLatencyMs.p95 >= 94 && result.allAttemptLatencyMs.p95 <= 96);
  assert.equal(summary.storageBins, storage);
  assert.ok(storage < 10000);
});

test("refresh rotates each actor sequentially inside a phase and reports elapsed coverage", async () => {
  const c = config();
  c.refreshIntervalMs = 1000;
  c.phases.forEach((p) => {
    p.seconds = 2;
    p.users = 1;
  });
  const inFlight = new Set();
  const result = await runWorkload(c, {
    request: async ({ jar }) => {
      assert.equal(inFlight.has(jar), false);
      inFlight.add(jar);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight.delete(jar);
      return { ms: 1, ok: true, status: 200, reason: null };
    },
  });
  assert.equal(result.passed, true);
  for (const phase of result.phases) {
    assert.ok(phase.byOperation.refresh.attempts >= 2);
    assert.equal(phase.actorsCompletedDuration, 1);
    assert.equal(phase.durationCompleted, true);
    assert.ok(phase.elapsedMs >= 2000);
  }
});

test("an actor lost on refresh makes requested concurrency coverage fail", async () => {
  const result = await runWorkload(config(), {
    request: async ({ path }) => ({
      ms: 1,
      ok: !path.endsWith("/refresh"),
      status: path.endsWith("/refresh") ? 401 : 200,
      reason: null,
    }),
  });
  assert.equal(result.passed, false);
  assert.ok(
    result.phases.every((p) => p.durationCompleted === false && p.actorsCompletedDuration === 0),
  );
});

test("fixture proxy credentials are local-only and transmitted per distinct actor without evidence leaks", async () => {
  const c = {
    ...config(),
    mode: "local-endurance",
    disposableFixtures: true,
    fixtureProxyToken: "f".repeat(64),
  };
  assert.throws(() => validateConfig({ ...c, mode: "local-smoke" }));
  assert.throws(() => validateConfig({ ...c, fixtureProxyToken: "short" }));
  const actors = new Set();
  const result = await runWorkload(c, {
    request: async ({ fixtureProxy }) => {
      assert.equal(fixtureProxy.token, c.fixtureProxyToken);
      actors.add(fixtureProxy.actor);
      return { ms: 1, ok: true, status: 200, reason: null };
    },
  });
  assert.deepEqual([...actors], [0, 1]);
  assert.equal(JSON.stringify(result).includes(c.fixtureProxyToken), false);
});

test("periodic progress is sanitized and latency gates cannot turn a slow functional success into a performance pass", async () => {
  const events = [];
  const c = { ...config(), slo: { requestP95Ms: 1000, journeyP95Ms: 3000 } };
  assert.throws(() => validateConfig({ ...c, slo: { requestP95Ms: 0, journeyP95Ms: 3000 } }));
  const result = await runWorkload(c, {
    request: async () => ({ ms: 2000, ok: true, status: 200, reason: null }),
    onProgress: (progress) => events.push(progress),
    progressIntervalMs: 500,
  });
  assert.equal(result.passed, true);
  assert.equal(result.performancePassed, false);
  assert.equal(result.slo.requestP95Ms, 1000);
  assert.ok(
    events.some(
      (event) => event.phase === "sustained" && event.elapsedMs >= 500 && event.activeActors === 2,
    ),
  );
  assert.ok(
    result.phases.filter((p) => p.name !== "warmup").every((p) => p.performancePassed === false),
  );
  assert.equal(JSON.stringify(events).includes("secret"), false);
  assert.equal(JSON.stringify(events).includes("@test"), false);
});

test("every configured actor must finish at least one journey before concurrency coverage can pass", async () => {
  const c = config();
  const actors = new Map();
  const result = await runWorkload(c, {
    request: async ({ jar, path, signal }) => {
      if (path.endsWith("/login")) actors.set(jar, actors.size);
      if (actors.get(jar) === 1 && path.endsWith("/me")) {
        await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
        return { ms: 1000, ok: false, status: 0, reason: "phase-deadline" };
      }
      return { ms: 1, ok: true, status: 200, reason: null };
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.phases[1].actorsWithCompletedJourneys, 1);
  assert.equal(result.phases[1].minCompletedJourneysPerActor, 0);
});
