import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertIsolatedFixtureTarget } from "./isolated-target.mjs";

assertIsolatedFixtureTarget({
  databaseUrl: process.env.E2E_OWNER_DATABASE_URL,
  authUrl: process.env.SUPABASE_URL,
});
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
const runDirectory = mkdtempSync(resolve(directory, "run-"));
const startedAt = new Date().toISOString();
writeFileSync(
  resolve(directory, "evidence.json"),
  JSON.stringify({ startedAt, status: "running", probes: [] }, null, 2),
);
const evidence = [];
function testsFrom(suites) {
  return suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) => spec.tests),
    ...testsFrom(suite.suites ?? []),
  ]);
}
for (const probe of probes) {
  const seed = spawnSync(process.execPath, ["scripts/e2e/seed-browser-scenarios.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (seed.status !== 0) throw new Error("Could not seed a fresh failure-probe scenario");
  const report = resolve(runDirectory, `${probe.fault}.json`);
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
      env: { ...process.env, E2E_FAILURE_PROBE: probe.fault, PLAYWRIGHT_JSON_OUTPUT_FILE: report },
      encoding: "utf8",
    },
  );
  if (result.error) throw result.error;
  const data = JSON.parse(readFileSync(report, "utf8"));
  const tests = testsFrom(data.suites);
  const test = tests[0];
  const failures = test?.results.flatMap((result) => result.errors ?? []) ?? [];
  const applied = test?.annotations?.some(
    (annotation) => annotation.type === "failure-probe" && annotation.description === probe.fault,
  );
  if (
    result.status !== 1 ||
    (data.errors?.length ?? 0) !== 0 ||
    tests.length !== 1 ||
    test?.results.length !== 1 ||
    test?.results[0]?.status !== "failed" ||
    !applied ||
    !failures.some((error) => probe.expected.test(error.message ?? ""))
  )
    throw new Error(
      `Probe ${probe.fault} did not fail at its intended outcome assertion. Inspect ${report}.`,
    );
  evidence.push({ fault: probe.fault, detected: true, spec: probe.spec });
  console.log(`Detected injected fault: ${probe.fault}`);
}
writeFileSync(
  resolve(directory, "evidence.json"),
  JSON.stringify(
    { startedAt, generatedAt: new Date().toISOString(), status: "passed", probes: evidence },
    null,
    2,
  ),
);
