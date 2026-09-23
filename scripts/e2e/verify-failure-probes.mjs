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
// Only the known journey filename and numeric coordinates may leave a raw report.
// Error messages, stack text, attachments and process output can contain credentials.
function sourceLocations(errors, spec) {
  const file = `tests/browser/journeys/${spec}.spec.ts`;
  const locations = new Map();
  function add(candidate, line, column) {
    const normalized =
      typeof candidate === "string"
        ? candidate
            .trim()
            .replace(/^at\s+/, "")
            .replaceAll("\\", "/")
        : "";
    if (normalized !== file && !normalized.endsWith(`/${file}`)) return;
    if (
      ![line, column].every((value) => Number.isSafeInteger(value) && value > 0 && value < 10000000)
    )
      return;
    locations.set(`${line}:${column}`, { file, line, column });
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
    evidence.push({ fault: probe.fault, detected: true, spec: probe.spec });
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
