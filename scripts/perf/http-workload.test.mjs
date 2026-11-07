import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  benchmarkClientAddress,
  validateConfig,
  summarize,
  requestJson,
  runWorkload,
} from "./http-workload.mjs";

/** Calls `onStart` as each measured phase begins (its first progress report). */
function onPhaseStart(onStart) {
  let current = null;
  return (progress) => {
    if (progress.phase !== "setup" && progress.phase !== current) {
      current = progress.phase;
      onStart(progress.phase);
    }
  };
}

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
    onProgress: onPhaseStart(() => {
      phaseStarted = performance.now();
    }),
    request: async ({ path }) => {
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
      if (!path.endsWith("/login") && !path.endsWith("/enrollments"))
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
    onProgress: onPhaseStart(() => {
      identities = 0;
    }),
    request: async ({ path, signal }) => {
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
    onProgress: onPhaseStart(() => {
      reads = 0;
    }),
    request: async ({ path }) => {
      if (path.endsWith("/lessons/lesson") && ++reads === 2)
        await new Promise((resolve) => setTimeout(resolve, 1300));
      return { ms: 1300, ok: true, status: 200, reason: null };
    },
  });
  assert.equal(result.passed, false);
  assert.equal(result.performancePassed, false);
  assert.ok(result.phases.every((p) => p.deadlineOverruns === 1 && p.incompleteJourneys === 1));
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
    { refreshIntervalMs: 300000 },
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

test("each actor sends one request at a time inside a phase and reports elapsed coverage", async () => {
  const c = config();
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
    assert.equal(phase.byOperation.refresh, undefined);
    assert.ok(phase.byOperation.identity.attempts >= 2);
    assert.equal(phase.actorsCompletedDuration, 1);
    assert.equal(phase.durationCompleted, true);
    assert.ok(phase.elapsedMs >= 2000);
  }
});

test("a session the API stops accepting fails the run", async () => {
  const result = await runWorkload(config(), {
    request: async ({ path }) => ({
      ms: 1,
      ok: !path.endsWith("/me"),
      status: path.endsWith("/me") ? 401 : 200,
      reason: null,
    }),
  });
  assert.equal(result.passed, false);
  assert.ok(result.phases.every((p) => p.requests.statuses["401"] > 0));
});

const stagingConfig = (users = 500) => ({
  ...config(),
  mode: "staging",
  origin: "https://staging.example.test",
  build: "staging-release",
  disposableFixtures: true,
  clientAddressHeader: "cf-connecting-ip",
  users: Array.from({ length: users }, (_, i) => ({
    email: `learner${i}@example.test`,
    password: "secret",
  })),
  phases: [
    { name: "warmup", users: 100, seconds: 120 },
    { name: "sustained", users: 300, seconds: 900 },
    { name: "burst", users, seconds: 300 },
    { name: "endurance", users: 300, seconds: 7200 },
  ],
});

test("staging runs reach the 500-learner launch peak and no further", () => {
  const approved = "https://staging.example.test";
  assert.doesNotThrow(() => validateConfig(stagingConfig(), approved));
  assert.throws(() => validateConfig(stagingConfig(501), approved));
  assert.throws(() =>
    validateConfig({ ...config(), clientAddressHeader: "cf-connecting-ip" }, approved),
  );
  assert.throws(() =>
    validateConfig({ ...stagingConfig(), clientAddressHeader: "x-forwarded-for" }, approved),
  );
});

test("each learner gets its own benchmark-range client address", () => {
  const addresses = Array.from({ length: 500 }, (_, i) => benchmarkClientAddress(i));
  assert.equal(new Set(addresses).size, 500);
  assert.ok(addresses.every((a) => /^198\.(18|19)\.\d{1,3}\.\d{1,3}$/.test(a)));
  assert.equal(addresses[0], "198.18.0.1");
  assert.equal(addresses[250], "198.18.1.1");
  assert.throws(() => benchmarkClientAddress(-1));
});

test("the client address goes out per actor, and the Better Auth session cookie is kept", async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ address: req.headers["cf-connecting-ip"], cookie: req.headers.cookie ?? "" });
    res.writeHead(200, {
      "content-type": "application/json",
      "set-cookie": [
        "__Secure-atlas_session=session-value; Path=/; Secure; HttpOnly",
        "unrelated=ignored; Path=/",
      ],
    });
    res.end(JSON.stringify({ data: { ok: true } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const jar = new Map();
    const clientAddress = { header: "cf-connecting-ip", value: benchmarkClientAddress(7) };
    await requestJson({ origin, path: "/login", jar, timeoutMs: 1000, clientAddress });
    await requestJson({ origin, path: "/me", jar, timeoutMs: 1000, clientAddress });
    assert.deepEqual([...jar.keys()], ["__Secure-atlas_session"]);
    assert.equal(seen[0].address, "198.18.0.8");
    assert.equal(seen[1].cookie, "__Secure-atlas_session=session-value");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
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
  const tickEvents = [];
  const intervals = [];
  let tick = null;
  const c = { ...config(), slo: { requestP95Ms: 1000, journeyP95Ms: 3000 } };
  assert.throws(() => validateConfig({ ...c, slo: { requestP95Ms: 0, journeyP95Ms: 3000 } }));
  const result = await runWorkload(c, {
    request: async () => {
      // One periodic report from inside the sustained phase, while both actors are mid-journey.
      // The test fires it rather than a wall-clock timer, which a slow runner could delay past the phase.
      if (tick && events.at(-1)?.phase === "sustained" && tickEvents.length === 0) {
        const before = events.length;
        tick();
        tickEvents.push(...events.slice(before));
      }
      return { ms: 2000, ok: true, status: 200, reason: null };
    },
    onProgress: (progress) => events.push(progress),
    progressIntervalMs: 500,
    startProgressTimer: (report, ms) => {
      intervals.push(ms);
      tick = report;
      return () => {
        tick = null;
      };
    },
  });
  assert.equal(result.passed, true);
  assert.equal(result.performancePassed, false);
  assert.equal(result.slo.requestP95Ms, 1000);
  assert.deepEqual(intervals, [500, 500, 500]);
  assert.equal(tickEvents.length, 1);
  assert.equal(tickEvents[0].phase, "sustained");
  assert.equal(tickEvents[0].activeActors, 2);
  assert.equal(tickEvents[0].targetActors, 2);
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
