import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export function validateConfig(c, approvedOrigin = process.env.PERF_APPROVED_STAGING_ORIGIN) {
  const origin = new URL(c.origin);
  if (origin.origin !== c.origin || origin.username || origin.password)
    throw new Error("An exact credential-free origin is required");
  if (c.mode === "local-smoke") {
    if (
      origin.protocol !== "http:" ||
      origin.hostname !== "fundedbeyond.localhost" ||
      origin.port !== "3100"
    )
      throw new Error("Local smoke requires the isolated F16 frontend origin on port 3100");
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
  const maxSeconds = c.mode === "local-smoke" ? 60 : 3600;
  if (!integer(c.pacingMs, 100, 60000) || !integer(c.timeoutMs, 100, 120000))
    throw new Error("Invalid pacing/timeout");
  if (
    !Array.isArray(c.phases) ||
    c.phases.length !== 3 ||
    c.phases.map((p) => p.name).join() !== "warmup,sustained,burst" ||
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

/** One origin, no redirects, bounded body/time, in-memory cookie jar. Artifacts never include response bodies or cookies. */
export async function requestJson({
  origin,
  path,
  method = "GET",
  body,
  jar,
  timeoutMs,
  signal,
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

export async function runWorkload(config, { request = requestJson } = {}) {
  const c = validateConfig(config);
  const actors = c.users.map(() => ({ jar: new Map() }));
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
      ...options,
    })),
  });
  // Authentication and one-time enrollment are measured separately, never silently hidden in warmup.
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
    await delay(c.pacingMs);
  }
  if (setup.length === actors.length * 2 && setup.every((s) => s.ok)) {
    for (const phase of c.phases) {
      const requests = [];
      const journeys = [];
      const started = performance.now();
      const deadline = started + phase.seconds * 1000;
      const signal = AbortSignal.timeout(phase.seconds * 1000);
      let incompleteJourneys = 0;
      let cancelledRequests = 0;
      // Closed loop: one sequence at a time per distinct actor. Report achieved load, not a fixed arrival-rate capacity claim.
      await Promise.all(
        actors.slice(0, phase.users).map(async (actor) => {
          const refresh = await send(actor, "refresh", "/api/v1/public/auth/refresh", {
            signal,
            method: "POST",
            body: {},
            check: (b) => b?.data?.refreshed === true,
          });
          if (refresh.reason === "phase-deadline") {
            cancelledRequests++;
            return;
          }
          requests.push(refresh);
          if (!refresh.ok) return;
          // Atlas stores percentage progress, so the fixture must choose an exactly representable position.
          const position = c.fixture.positionSeconds;
          while (performance.now() < deadline && requests.length < 250000) {
            const begin = performance.now();
            let ok = true;
            let incomplete = false;
            const steps = [
              [
                "identity",
                "/api/v1/me",
                { check: (b) => typeof b?.data?.membership?.id === "string" },
              ],
              ["course", `/api/v1/courses/${courseId}`, { check: (b) => b?.data?.id === courseId }],
              ["lesson", `/api/v1/lessons/${lessonId}`, { check: (b) => b?.data?.id === lessonId }],
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
              if (performance.now() >= deadline) {
                incomplete = true;
                break;
              }
              const result = await send(actor, name, path, { ...options, signal });
              if (result.reason === "phase-deadline") {
                cancelledRequests++;
                incomplete = true;
                break;
              }
              requests.push(result);
              if (!result.ok) {
                ok = false;
                break;
              }
            }
            if (incomplete) {
              incompleteJourneys++;
              break;
            }
            journeys.push({ ms: performance.now() - begin, ok, status: ok ? 200 : 0 });
            const remaining = deadline - performance.now();
            if (remaining > 0) await delay(Math.min(c.pacingMs, remaining));
          }
        }),
      );
      const elapsedMs = performance.now() - started;
      phases.push({
        ...phase,
        includedInSizing:
          phase.name !== "warmup" && c.mode === "staging" && c.build !== "development",
        elapsedMs,
        incompleteJourneys,
        cancelledRequests,
        requestRps: requests.length / (elapsedMs / 1000),
        truncated: requests.length >= 250000,
        requests: summarize(requests),
        journeys: summarize(journeys),
        byOperation: Object.fromEntries(
          [...new Set(requests.map((r) => r.name))].map((name) => [
            name,
            summarize(requests.filter((r) => r.name === name)),
          ]),
        ),
      });
    }
  }
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    mode: c.mode,
    origin: c.origin,
    build: c.build,
    planningTarget: { sustained: 100, burst: 200 },
    capacityVerified: false,
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
        "soak",
        "mobile browser metrics (separate runner)",
      ],
    },
    passed:
      setup.length === actors.length * 2 &&
      setup.every((s) => s.ok) &&
      phases.length === 3 &&
      phases.every((p) => !p.truncated && p.requests.errors === 0 && p.journeys.attempts > 0),
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
    writeFileSync(
      outputPath,
      `${JSON.stringify({ capturedAt: new Date().toISOString(), passed: false, capacityVerified: false, status: "incomplete" })}\n`,
    );
    const result = await runWorkload(JSON.parse(readFileSync(configPath, "utf8")));
    writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      JSON.stringify({
        passed: result.passed,
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
    if (!result.passed) process.exitCode = 1;
  } catch {
    console.error(
      "Performance run rejected or could not complete. Check target, private configuration and service availability; no credentials were logged.",
    );
    process.exitCode = 1;
  }
}
