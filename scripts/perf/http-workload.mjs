import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export function validateConfig(c, approvedOrigin = process.env.PERF_APPROVED_STAGING_ORIGIN) {
  const origin = new URL(c.origin);
  if (origin.origin !== c.origin || origin.username || origin.password)
    throw new Error("An exact credential-free origin is required");
  if (c.mode === "local-smoke" || c.mode === "local-endurance") {
    if (
      origin.protocol !== "http:" ||
      origin.hostname !== "fundedbeyond.localhost" ||
      origin.port !== "3100"
    )
      throw new Error("Local smoke requires the isolated F16 frontend origin on port 3100");
    if (c.mode === "local-endurance" && c.disposableFixtures !== true)
      throw new Error("Local endurance requires explicitly disposable fixtures");
  } else if (
    c.mode !== "staging" ||
    origin.protocol !== "https:" ||
    c.origin !== approvedOrigin ||
    c.disposableFixtures !== true
  ) {
    throw new Error(
      "Staging requires HTTPS, disposableFixtures=true and an exact PERF_APPROVED_STAGING_ORIGIN",
    );
  }
  if (typeof c.build !== "string" || !c.build.trim() || c.build.length > 120)
    throw new Error("Build provenance is required");
  const maxUsers = c.mode === "local-smoke" ? 5 : 200;
  const maxSeconds = c.mode === "local-smoke" ? 60 : 7200;
  if (!integer(c.pacingMs, 100, 60000) || !integer(c.timeoutMs, 100, 120000))
    throw new Error("Invalid pacing/timeout");
  if (!integer(c.drainMs ?? 0, 0, 120000))
    throw new Error("Phase drain must be bounded between zero and two minutes");
  if (!integer(c.refreshIntervalMs ?? 300000, 1000, 900000))
    throw new Error("Refresh interval must be between one second and fifteen minutes");
  if (!integer(c.setupPacingMs ?? c.pacingMs, 100, 60000)) throw new Error("Invalid setup pacing");
  if (
    c.fixtureProxyToken !== undefined &&
    (c.mode !== "local-endurance" || !/^[a-zA-Z0-9_-]{32,128}$/.test(c.fixtureProxyToken))
  )
    throw new Error("Fixture proxy credentials require isolated local endurance mode");
  if (
    c.slo !== undefined &&
    (!integer(c.slo?.requestP95Ms, 1, 120000) || !integer(c.slo?.journeyP95Ms, 1, 600000))
  )
    throw new Error("Explicit positive request and journey latency gates are required");
  if (
    !Array.isArray(c.phases) ||
    !["warmup,sustained,burst", "warmup,sustained,burst,endurance"].includes(
      c.phases.map((p) => p.name).join(),
    ) ||
    (c.mode === "local-smoke" && c.phases.length !== 3) ||
    c.phases.some((p) => !integer(p.users, 1, maxUsers) || !integer(p.seconds, 1, maxSeconds))
  )
    throw new Error("Require bounded warmup, sustained and burst phases");
  const users = Math.max(...c.phases.map((p) => p.users));
  if (
    !Array.isArray(c.users) ||
    c.users.length < users ||
    c.users.length > maxUsers ||
    c.users.some(
      (u) =>
        typeof u.email !== "string" ||
        !u.email.includes("@") ||
        typeof u.password !== "string" ||
        !u.password,
    )
  )
    throw new Error("Provide a separate fixture identity per concurrent learner");
  if (new Set(c.users.map((u) => u.email.trim().toLowerCase())).size !== c.users.length)
    throw new Error("Duplicate learner identities are prohibited");
  for (const key of ["courseId", "lessonId"])
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(c.fixture?.[key] ?? ""))
      throw new Error("Explicit course and lesson fixture IDs are required");
  if (!integer(c.fixture.positionSeconds, 1, 86400))
    throw new Error("A fixture position aligned with the lesson percentage precision is required");
  return c;
}

function latency(samples) {
  if (!samples.length) return null;
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  const p = (percentile) => sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)];
  return { p50: p(0.5), p95: p(0.95), p99: p(0.99), max: sorted.at(-1) };
}
export function summarize(samples) {
  const successes = samples.filter((s) => s.ok);
  return {
    attempts: samples.length,
    successes: successes.length,
    errors: samples.length - successes.length,
    errorRate: samples.length ? (samples.length - successes.length) / samples.length : null,
    successLatencyMs: latency(successes),
    allAttemptLatencyMs: latency(samples),
    statuses: Object.fromEntries(
      [...new Set(samples.map((s) => s.status))].map((status) => [
        String(status),
        samples.filter((s) => s.status === status).length,
      ]),
    ),
  };
}

// Fixed storage regardless of run length. Integer upper bounds grow by ~1%;
// reported percentiles are conservative bucket bounds, never exact samples.
const latencyBounds = [0];
for (let bound = 1; bound < 7200000; bound = Math.ceil(bound * 1.01)) latencyBounds.push(bound);
latencyBounds.push(Infinity);
export function createSummary() {
  const all = new Float64Array(latencyBounds.length);
  const successful = new Float64Array(latencyBounds.length);
  const statuses = new Float64Array(600);
  let attempts = 0,
    successes = 0,
    max = 0,
    successMax = 0;
  const distribution = (buckets, count, maximum) => {
    if (!count) return null;
    const percentile = (fraction) => {
      let sum = 0;
      for (let i = 0; i < buckets.length; i++) {
        sum += buckets[i];
        if (sum >= Math.ceil(count * fraction)) return Math.min(latencyBounds[i], maximum);
      }
      return maximum;
    };
    return { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: maximum };
  };
  return {
    storageBins: all.length + successful.length + statuses.length,
    add(sample) {
      if (!Number.isFinite(sample.ms) || sample.ms < 0) throw new Error("Invalid latency sample");
      let low = 0,
        high = latencyBounds.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (latencyBounds[middle] < sample.ms) low = middle + 1;
        else high = middle;
      }
      all[low]++;
      attempts++;
      max = Math.max(max, sample.ms);
      statuses[integer(sample.status, 0, 599) ? sample.status : 0]++;
      if (sample.ok) {
        successful[low]++;
        successes++;
        successMax = Math.max(successMax, sample.ms);
      }
    },
    snapshot() {
      return {
        attempts,
        successes,
        errors: attempts - successes,
        errorRate: attempts ? (attempts - successes) / attempts : null,
        successLatencyMs: distribution(successful, successes, successMax),
        allAttemptLatencyMs: distribution(all, attempts, max),
        statuses: Object.fromEntries([...statuses.entries()].filter(([, count]) => count)),
        latencyMethod:
          "bounded histogram; percentile upper bounds (integer milliseconds, approximately 1% buckets)",
      };
    },
  };
}

/** One origin, no redirects, bounded body/time, in-memory cookie jar. Artifacts never include response bodies or cookies. */
export async function requestJson({
  origin,
  path,
  method = "GET",
  body,
  jar,
  timeoutMs,
  signal,
  fixtureProxy,
  check = (value) => value?.data != null,
}) {
  const url = new URL(path, origin);
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    url.origin !== origin
  )
    throw new Error("Cross-origin request rejected");
  const start = performance.now();
  let status = 0;
  try {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "application/json",
        origin,
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
        cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
        ...(fixtureProxy
          ? {
              "x-atlas-perf-token": fixtureProxy.token,
              "x-atlas-perf-actor": String(fixtureProxy.actor),
            }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    status = response.status;
    if (status < 200 || status >= 300) {
      await response.body?.cancel();
      return { ms: performance.now() - start, status, ok: false, reason: "http-status" };
    }
    // Bound decoded size too: Content-Length alone cannot protect against compressed bodies.
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      if (bytes > 2_000_000) throw new Error("response-limit");
      chunks.push(chunk);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!check(value))
      return { ms: performance.now() - start, status, ok: false, reason: "unexpected-payload" };
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(";")[0];
      const index = first.indexOf("=");
      const name = first.slice(0, index);
      if (["atlas_access_token", "atlas_refresh_token", "atlas_session_persistent"].includes(name))
        jar.set(name, first.slice(index + 1));
    }
    return { ms: performance.now() - start, status, ok: true, reason: null };
  } catch {
    return {
      ms: performance.now() - start,
      status,
      ok: false,
      reason: signal?.aborted ? "phase-deadline" : "transport-or-body",
    };
  }
}

export async function runWorkload(
  config,
  { request = requestJson, onProgress = () => {}, progressIntervalMs = 60000 } = {},
) {
  const c = validateConfig(config);
  if (!integer(progressIntervalMs, 100, 60000)) throw new Error("Invalid progress interval");
  const actors = c.users.map((_, index) => ({ jar: new Map(), index }));
  const setup = [];
  const phases = [];
  const { courseId, lessonId } = c.fixture;
  const send = async (actor, name, path, options = {}) => ({
    name,
    ...(await request({
      origin: c.origin,
      path,
      jar: actor.jar,
      timeoutMs: c.timeoutMs,
      ...(c.fixtureProxyToken
        ? { fixtureProxy: { token: c.fixtureProxyToken, actor: actor.index } }
        : {}),
      ...options,
    })),
  });
  // Authentication and one-time enrollment are measured separately, never silently hidden in warmup.
  const runStartedAt = new Date().toISOString();
  onProgress({
    capturedAt: runStartedAt,
    phase: "setup",
    completedActors: 0,
    targetActors: actors.length,
    capacityVerified: false,
  });
  for (let i = 0; i < actors.length; i++) {
    const login = await send(actors[i], "login", "/api/v1/public/auth/login", {
      method: "POST",
      body: { email: c.users[i].email, password: c.users[i].password },
      check: (b) => b?.data?.status === "AUTHENTICATED",
    });
    setup.push(login);
    if (!login.ok) break;
    const enrollment = await send(actors[i], "enrollment", "/api/v1/enrollments", {
      method: "POST",
      body: { courseId },
      check: (b) => b?.data?.courseId === courseId && b?.data?.status === "active",
    });
    setup.push(enrollment);
    if (!enrollment.ok) break;
    onProgress({
      capturedAt: new Date().toISOString(),
      phase: "setup",
      completedActors: i + 1,
      targetActors: actors.length,
      capacityVerified: false,
    });
    await delay(c.setupPacingMs ?? c.pacingMs);
  }
  if (setup.length === actors.length * 2 && setup.every((s) => s.ok)) {
    for (const phase of c.phases) {
      const requests = createSummary();
      const journeys = createSummary();
      const operations = new Map();
      const record = (sample) => {
        requests.add(sample);
        if (!operations.has(sample.name)) operations.set(sample.name, createSummary());
        operations.get(sample.name).add(sample);
      };
      const started = performance.now();
      const startedAt = new Date().toISOString();
      const deadline = started + phase.seconds * 1000;
      const drainMs = c.drainMs ?? 0;
      const hardDeadline = deadline + drainMs;
      const signal = AbortSignal.timeout(phase.seconds * 1000 + drainMs);
      let incompleteJourneys = 0;
      let cancelledRequests = 0;
      let deadlineOverruns = 0;
      let actorsCompletedDuration = 0;
      const completedJourneysByActor = new Uint32Array(phase.users);
      let activeActors = phase.users;
      const reportProgress = () =>
        onProgress({
          capturedAt: new Date().toISOString(),
          phase: phase.name,
          elapsedMs: performance.now() - started,
          targetSeconds: phase.seconds,
          activeActors,
          targetActors: phase.users,
          actorsCompletedDuration,
          requests: requests.snapshot(),
          journeys: journeys.snapshot(),
          capacityVerified: false,
        });
      reportProgress();
      const progressTimer = setInterval(reportProgress, progressIntervalMs);
      progressTimer.unref();
      // Closed loop: one sequence at a time per distinct actor. Report achieved load, not a fixed arrival-rate capacity claim.
      try {
        await Promise.all(
          actors.slice(0, phase.users).map(async (actor, actorIndex) => {
            try {
              let nextRefresh = 0;
              // Atlas stores percentage progress, so the fixture must choose an exactly representable position.
              const position = c.fixture.positionSeconds;
              while (performance.now() < deadline) {
                if (performance.now() >= nextRefresh) {
                  const refresh = await send(actor, "refresh", "/api/v1/public/auth/refresh", {
                    signal,
                    method: "POST",
                    body: {},
                    check: (b) => b?.data?.refreshed === true,
                  });
                  if (refresh.reason === "phase-deadline") {
                    cancelledRequests++;
                    break;
                  }
                  record(refresh);
                  if (performance.now() >= hardDeadline) {
                    deadlineOverruns++;
                    break;
                  }
                  if (!refresh.ok) return;
                  nextRefresh = performance.now() + (c.refreshIntervalMs ?? 300000);
                }
                // Refresh may finish during drain; never admit a new journey after the load window.
                if (performance.now() >= deadline) break;
                const begin = performance.now();
                let ok = true;
                let incomplete = false;
                const steps = [
                  [
                    "identity",
                    "/api/v1/me",
                    { check: (b) => typeof b?.data?.membership?.id === "string" },
                  ],
                  [
                    "course",
                    `/api/v1/courses/${courseId}`,
                    { check: (b) => b?.data?.id === courseId },
                  ],
                  [
                    "lesson",
                    `/api/v1/lessons/${lessonId}`,
                    { check: (b) => b?.data?.id === lessonId },
                  ],
                  [
                    "progress-save",
                    `/api/v1/lessons/${lessonId}/progress`,
                    {
                      method: "POST",
                      body: { positionSeconds: position, completed: false },
                      check: (b) => b?.data?.positionSeconds === position,
                    },
                  ],
                  [
                    "progress-read",
                    `/api/v1/lessons/${lessonId}`,
                    { check: (b) => b?.data?.progress?.positionSeconds === position },
                  ],
                ];
                for (const [name, path, options] of steps) {
                  if (performance.now() >= hardDeadline) {
                    incomplete = true;
                    break;
                  }
                  const result = await send(actor, name, path, { ...options, signal });
                  if (result.reason === "phase-deadline") {
                    cancelledRequests++;
                    incomplete = true;
                    break;
                  }
                  record(result);
                  if (performance.now() >= hardDeadline) {
                    deadlineOverruns++;
                    incomplete = true;
                    break;
                  }
                  if (!result.ok) {
                    ok = false;
                    break;
                  }
                }
                if (incomplete) {
                  incompleteJourneys++;
                  break;
                }
                journeys.add({ ms: performance.now() - begin, ok, status: ok ? 200 : 0 });
                completedJourneysByActor[actorIndex]++;
                const remaining = deadline - performance.now();
                if (remaining > 0) await delay(Math.ceil(Math.min(c.pacingMs, remaining)));
              }
              // Timer callbacks may run just below a fractional millisecond deadline.
              if (signal.aborted && performance.now() < deadline)
                await delay(Math.ceil(deadline - performance.now()));
              if (performance.now() >= deadline) actorsCompletedDuration++;
            } finally {
              activeActors--;
            }
          }),
        );
      } finally {
        clearInterval(progressTimer);
      }
      reportProgress();
      const elapsedMs = performance.now() - started;
      phases.push({
        ...phase,
        includedInSizing:
          phase.name !== "warmup" && c.mode === "staging" && c.build !== "development",
        elapsedMs,
        drainMs,
        drainElapsedMs: Math.max(0, elapsedMs - phase.seconds * 1000),
        startedAt,
        finishedAt: new Date().toISOString(),
        actorsCompletedDuration,
        actorsWithCompletedJourneys: completedJourneysByActor.filter((count) => count > 0).length,
        minCompletedJourneysPerActor: Math.min(...completedJourneysByActor),
        durationCompleted:
          actorsCompletedDuration === phase.users && elapsedMs >= phase.seconds * 1000,
        incompleteJourneys,
        cancelledRequests,
        deadlineOverruns,
        requestRps: requests.snapshot().attempts / (elapsedMs / 1000),
        truncated: false,
        requests: requests.snapshot(),
        journeys: journeys.snapshot(),
        byOperation: Object.fromEntries(
          [...operations].map(([name, metrics]) => [name, metrics.snapshot()]),
        ),
      });
    }
  }
  const passed =
    setup.length === actors.length * 2 &&
    setup.every((s) => s.ok) &&
    phases.length === c.phases.length &&
    phases.every(
      (p) =>
        p.durationCompleted &&
        p.actorsWithCompletedJourneys === p.users &&
        !p.truncated &&
        p.incompleteJourneys === 0 &&
        p.cancelledRequests === 0 &&
        p.deadlineOverruns === 0 &&
        p.requests.errors === 0 &&
        p.journeys.attempts > 0,
    );
  for (const phase of phases)
    phase.performancePassed =
      c.slo && phase.name !== "warmup"
        ? phase.durationCompleted &&
          phase.actorsWithCompletedJourneys === phase.users &&
          phase.incompleteJourneys === 0 &&
          phase.cancelledRequests === 0 &&
          phase.deadlineOverruns === 0 &&
          phase.requests.errors === 0 &&
          phase.journeys.attempts > 0 &&
          phase.requests.successLatencyMs?.p95 <= c.slo.requestP95Ms &&
          phase.journeys.successLatencyMs?.p95 <= c.slo.journeyP95Ms
        : null;
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    startedAt: runStartedAt,
    mode: c.mode,
    origin: c.origin,
    build: c.build,
    planningTarget: { sustained: 100, burst: 200 },
    capacityVerified: false,
    slo: c.slo ? { requestP95Ms: c.slo.requestP95Ms, journeyP95Ms: c.slo.journeyP95Ms } : null,
    performancePassed: c.slo
      ? passed && phases.filter((p) => p.name !== "warmup").every((p) => p.performancePassed)
      : null,
    pacingMs: c.pacingMs,
    setupPacingMs: c.setupPacingMs ?? c.pacingMs,
    refreshIntervalMs: c.refreshIntervalMs ?? 300000,
    model:
      "closed-loop distinct authenticated learners; think time follows each journey; setup measured separately",
    setup: summarize(setup),
    setupByOperation: Object.fromEntries(
      ["login", "enrollment"].map((name) => [
        name,
        summarize(setup.filter((r) => r.name === name)),
      ]),
    ),
    phases,
    telemetry: {
      poolWaitMs: null,
      queryMs: null,
      workerLagMs: null,
      reason:
        "Attach matching process pool metrics and worker backlog evidence; absence is not zero.",
    },
    coverage: {
      measured: [
        "login",
        "refresh",
        "identity",
        "course",
        "lesson",
        "progress-save",
        "progress-read",
      ],
      excluded: [
        "quiz lifecycle",
        "uploads",
        "exports",
        "background worker throughput",
        ...(phases.some((p) => p.name === "endurance" && p.seconds >= 7200 && p.durationCompleted)
          ? []
          : ["two-hour soak"]),
        "mobile browser metrics (separate runner)",
      ],
    },
    passed,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [configPath, outputPath = ".test-results/f17/http.json"] = process.argv.slice(2);
    if (!configPath)
      throw new Error("Usage: http-workload.mjs <private-config.json> [output.json]");
    if (resolve(configPath) === resolve(outputPath))
      throw new Error("Config and evidence paths must differ");
    mkdirSync(dirname(outputPath), { recursive: true });
    const incomplete = `${JSON.stringify({ capturedAt: new Date().toISOString(), passed: false, capacityVerified: false, status: "incomplete" })}\n`;
    writeFileSync(outputPath, incomplete);
    writeFileSync(`${outputPath}.progress.json`, incomplete);
    writeFileSync(`${outputPath}.progress.jsonl`, "");
    const result = await runWorkload(JSON.parse(readFileSync(configPath, "utf8")), {
      onProgress: (progress) => {
        const line = `${JSON.stringify(progress)}\n`;
        writeFileSync(`${outputPath}.progress.json`, line);
        appendFileSync(`${outputPath}.progress.jsonl`, line);
      },
    });
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      JSON.stringify({
        passed: result.passed,
        performancePassed: result.performancePassed,
        capacityVerified: false,
        outputPath,
        phases: result.phases.map((p) => ({
          name: p.name,
          attempts: p.requests.attempts,
          errors: p.requests.errors,
          p95: p.requests.successLatencyMs?.p95 ?? null,
        })),
      }),
    );
    if (!result.passed || result.performancePassed === false) process.exitCode = 1;
  } catch {
    console.error(
      "Performance run rejected or could not complete. Check target, private configuration and service availability; no credentials were logged.",
    );
    process.exitCode = 1;
  }
}
