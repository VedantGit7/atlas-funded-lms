import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertIsolatedFixtureTarget } from "./isolated-target.mjs";

const probes = [
  {
    fault: "completion-not-saved",
    spec: "02-learner-dashboard-enrollment",
    expected: /Status: completed|Lesson completed/,
  },
  { fault: "wrong-grade", spec: "03-learner-assessment", expected: /scorePercent/ },
  { fault: "role-not-revoked", spec: "09-admin-member-workflows", expected: /Revoked role/ },
  { fault: "review-skipped", spec: "06-instructor-authoring", expected: /REVIEW/ },
  {
    fault: "review-return-not-saved",
    spec: "07-review-approval",
    expected: /Returned course must leave the review queue/,
  },
  {
    fault: "entitlement-not-saved",
    spec: "10-platform-provision-entitlements",
    expected: /enabled/,
  },
  { fault: "foreign-read-allowed", spec: "11-cross-tenant-negative", expected: /404/ },
];
const directory = resolve(".test-results/f16-probes");
mkdirSync(directory, { recursive: true });
const startedAt = new Date().toISOString();
const evidence = [];
let current = { stage: "fixture-target" };
function persist(status) {
  writeFileSync(
    resolve(directory, "evidence.json"),
    JSON.stringify(
      {
        startedAt,
        generatedAt: new Date().toISOString(),
        status,
        probes: evidence,
        ...(status === "running" ? { current } : status === "failed" ? { failure: current } : {}),
      },
      null,
      2,
    ),
  );
}
function processSummary(result) {
  return {
    exitCode: Number.isInteger(result.status) ? result.status : null,
    signal:
      result.signal == null
        ? null
        : ["SIGTERM", "SIGKILL", "SIGABRT", "SIGINT"].includes(result.signal)
          ? result.signal
          : "other",
    errorCode: !result.error
      ? null
      : ["ENOBUFS", "ENOENT", "EACCES", "EPERM", "ETIMEDOUT"].includes(result.error.code)
        ? result.error.code
        : "other",
  };
}
function testsFrom(suites) {
  if (!Array.isArray(suites)) throw new Error("Invalid report suites");
  return suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) => {
      if (!Array.isArray(spec.tests)) throw new Error("Invalid report tests");
      for (const test of spec.tests) {
        if (!Array.isArray(test.results) || !Array.isArray(test.annotations ?? []))
          throw new Error("Invalid report test");
        for (const result of test.results)
          if (!result || !Array.isArray(result.errors ?? []))
            throw new Error("Invalid report result");
      }
      return spec.tests;
    }),
    ...testsFrom(suite.suites ?? []),
  ]);
}
// Only known source filenames and numeric coordinates may leave a raw report.
// Error messages, stack text, attachments and process output can contain credentials.
function sourceLocations(errors, spec) {
  const files = [
    `tests/browser/journeys/${spec}.spec.ts`,
    ...["auth", "hydration", "failure-probe", "navigation", "probe-phase"].map(
      (name) => `tests/browser/helpers/${name}.ts`,
    ),
  ];
  const locations = new Map();
  function add(candidate, line, column) {
    const normalized =
      typeof candidate === "string"
        ? candidate
            .trim()
            .replace(/^at\s+/, "")
            .replaceAll("\\", "/")
        : "";
    const file = files.find((file) => normalized === file || normalized.endsWith(`/${file}`));
    if (!file) return;
    if (
      ![line, column].every((value) => Number.isSafeInteger(value) && value > 0 && value < 10000000)
    )
      return;
    locations.set(`${file}:${line}:${column}`, { file, line, column });
  }
  for (const error of errors) {
    add(error?.location?.file, error?.location?.line, error?.location?.column);
    if (typeof error?.stack !== "string") continue;
    for (const frame of error.stack.split("\n")) {
      const match = /:(\d+):(\d+)\)?$/.exec(frame);
      if (match) add(frame.slice(0, match.index), Number(match[1]), Number(match[2]));
    }
  }
  return [...locations.values()].slice(0, 20);
}

// The probe's own dev servers log to its output, which is otherwise discarded: it can carry
// anything. Only the route shape and error code of the API's structured `route.failure` lines
// may leave it — enough to tell a login Supabase rejected from an API error or no API call at all.
function serverFailures(output) {
  const failures = [];
  for (const line of output.split("\n")) {
    if (failures.length === 20) break;
    const start = line.indexOf("{");
    if (start === -1 || !line.includes('"route.failure"')) continue;
    let value;
    try {
      value = JSON.parse(line.slice(start));
    } catch {
      continue;
    }
    if (value?.message !== "route.failure") continue;
    const route =
      typeof value.route === "string" && value.route.startsWith("/api/v1/")
        ? value.route
            .split("/")
            .slice(0, 12)
            .map((segment, index) =>
              index < 3 || (segment.length <= 32 && /^[a-z]+(?:-[a-z]+){0,3}$/.test(segment))
                ? segment
                : ":param",
            )
            .join("/")
        : "other";
    const errorCode =
      typeof value.errorCode === "string" && /^[A-Z][A-Z_]{1,39}$/.test(value.errorCode)
        ? value.errorCode
        : "other";
    failures.push({ route, errorCode });
  }
  return failures;
}

function phaseDiagnostics(test, spec) {
  const grading = spec === "03-learner-assessment";
  if (!grading && spec !== "02-learner-dashboard-enrollment") return {};
  const phases = new Set(
    grading
      ? [
          "J03 login",
          "J03 start",
          "J03 autosave",
          "J03 reload",
          "J03 submit",
          "J03 result",
          "J03 intercept upstream",
          "J03 intercept json",
          "J03 intercept fulfill",
        ]
      : [
          "J02 login",
          "J02 enrollment",
          "J02 course before enrollment",
          "J02 course after enrollment",
        ],
  );
  const phaseTimings = [];
  const bounded = (value) => Number.isFinite(value) && value >= 0 && value <= 86400000;
  for (const result of (test?.results ?? []).slice(0, 1)) {
    const phaseStarts = new Map();
    const resultStart = Date.parse(result.startTime);
    for (const annotation of (test?.annotations ?? []).slice(0, 100)) {
      if (
        annotation.type !== (grading ? "j03-phase-start" : "j02-phase-start") ||
        typeof annotation.description !== "string" ||
        annotation.description.length > 1024
      )
        continue;
      try {
        const value = JSON.parse(annotation.description);
        const offset = value?.startedAt - resultStart;
        if (phases.has(value?.phase) && Number.isSafeInteger(value.startedAt) && bounded(offset))
          phaseStarts.set(value.phase, offset);
      } catch {
        /* Never retain raw annotations. */
      }
    }
    const pending = Array.isArray(result.steps) ? [...result.steps] : [];
    for (let count = 0; pending.length && count < 1000 && phaseTimings.length < 20; count++) {
      const step = pending.shift();
      if (!step || typeof step !== "object") continue;
      if (phases.has(step.title) && (bounded(step.duration) || step.duration === -1)) {
        phaseTimings.push({
          phase: step.title,
          startOffsetMs: phaseStarts.get(step.title) ?? null,
          durationMs: step.duration === -1 ? null : step.duration,
          completed: step.duration !== -1,
          errorCategory: !step.error
            ? null
            : /timeout|timed out/i.test(String(step.error.message))
              ? "timeout"
              : "other",
        });
      }
      if (Array.isArray(step.steps)) pending.unshift(...step.steps.slice(0, 100));
    }
  }
  if (grading) {
    const upstreamStatuses = (test?.annotations ?? [])
      .slice(0, 100)
      .filter(
        (annotation) =>
          annotation.type === "j03-upstream-status" &&
          typeof annotation.description === "string" &&
          /^[1-5]\d{2}$/.test(annotation.description),
      )
      .slice(0, 10)
      .map((annotation) => Number(annotation.description));
    return { phaseTimings, upstreamStatuses };
  }
  const courseResponses = [];
  for (const annotation of (test?.annotations ?? []).slice(0, 100)) {
    if (annotation.type !== "j02-course-status" || typeof annotation.description !== "string")
      continue;
    if (annotation.description.length > 1024) continue;
    try {
      const value = JSON.parse(annotation.description);
      if (
        ["before", "after"].includes(value?.phase) &&
        Number.isInteger(value.status) &&
        value.status >= 100 &&
        value.status <= 599
      )
        courseResponses.push({ phase: value.phase, status: value.status });
    } catch {
      /* Raw annotation text must never enter evidence. */
    }
    if (courseResponses.length === 2) break;
  }
  return { phaseTimings, courseResponses };
}

persist("running");
try {
  assertIsolatedFixtureTarget({
    databaseUrl: process.env.E2E_OWNER_DATABASE_URL,
    authUrl: process.env.SUPABASE_URL,
  });
  const runDirectory = mkdtempSync(resolve(directory, "run-"));
  for (const probe of probes) {
    current = { fault: probe.fault, spec: probe.spec, stage: "seed" };
    persist("running");
    const seed = spawnSync(process.execPath, ["scripts/e2e/seed-browser-scenarios.mjs"], {
      stdio: "inherit",
      env: process.env,
    });
    current.process = processSummary(seed);
    if (seed.error || seed.status !== 0) throw new Error("Scenario seed failed");
    const report = resolve(runDirectory, `${probe.fault}.json`);
    current = { fault: probe.fault, spec: probe.spec, stage: "spawn" };
    persist("running");
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        `tests/browser/journeys/${probe.spec}.spec.ts`,
        "--workers=1",
        "--reporter=json",
        `--output=${runDirectory}/${probe.fault}`,
      ],
      {
        env: {
          ...process.env,
          E2E_FAILURE_PROBE: probe.fault,
          PLAYWRIGHT_JSON_OUTPUT_FILE: report,
        },
        encoding: "utf8",
      },
    );
    current.process = processSummary(result);
    current.serverFailures = serverFailures(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    if (result.error) throw new Error("Probe process failed");
    current.stage = "report";
    current.reportStatus = "pending";
    persist("running");
    let raw;
    try {
      raw = readFileSync(report, "utf8");
    } catch (error) {
      current.reportStatus = error.code === "ENOENT" ? "missing" : "unreadable";
      throw new Error("Probe report unavailable", { cause: error });
    }
    let data, tests;
    try {
      data = JSON.parse(raw);
      if (!Array.isArray(data.errors ?? [])) throw new Error("Invalid report errors");
      tests = testsFrom(data.suites);
    } catch {
      current.reportStatus = "invalid";
      throw new Error("Probe report invalid");
    }
    const test = tests[0];
    const failures = test?.results.flatMap((result) => result.errors ?? []) ?? [];
    const applied =
      test?.annotations?.some(
        (annotation) =>
          annotation?.type === "failure-probe" && annotation.description === probe.fault,
      ) ?? false;
    const intendedAssertionMatched = failures.some(
      (error) => typeof error?.message === "string" && probe.expected.test(error.message),
    );
    current = {
      ...current,
      stage: "outcome",
      reportStatus: "valid",
      testCount: tests.length,
      globalErrorCount: data.errors?.length ?? 0,
      resultCount: test?.results.length ?? 0,
      resultStatuses: (test?.results ?? []).map((result) =>
        ["passed", "failed", "timedOut", "skipped", "interrupted"].includes(result.status)
          ? result.status
          : "other",
      ),
      resultDurationsMs: (test?.results ?? []).map((result) =>
        Number.isFinite(result.duration) && result.duration >= 0 && result.duration <= 86400000
          ? result.duration
          : null,
      ),
      applied,
      intendedAssertionMatched,
      locations: sourceLocations([...failures, ...(data.errors ?? [])], probe.spec),
      ...phaseDiagnostics(test, probe.spec),
    };
    persist("running");
    if (
      result.status !== 1 ||
      (data.errors?.length ?? 0) !== 0 ||
      tests.length !== 1 ||
      test?.results.length !== 1 ||
      test?.results[0]?.status !== "failed" ||
      !applied ||
      !intendedAssertionMatched
    )
      throw new Error("Probe did not fail at its intended outcome assertion");
    evidence.push({
      fault: probe.fault,
      detected: true,
      spec: probe.spec,
      ...phaseDiagnostics(test, probe.spec),
    });
    persist("running");
    console.log(`Detected injected fault: ${probe.fault}`);
  }
  persist("passed");
} catch {
  persist("failed");
  throw new Error(
    `Failure-probe verification failed at ${current.stage}${current.fault ? ` for ${current.fault}` : ""}. Inspect .test-results/f16-probes/evidence.json.`,
  );
}
