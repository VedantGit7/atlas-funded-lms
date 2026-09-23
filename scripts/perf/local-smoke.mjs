// Uses only the disposable F16 fixture stack. Start it and regenerate scenarios first.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { parse } from "dotenv";
import { localEnv } from "../e2e/local-env.mjs";
import { runWorkload } from "./http-workload.mjs";
createRequire(import.meta.url)("../e2e/local-dns.cjs");
mkdirSync(".test-results/f17", { recursive: true });
writeFileSync(
  ".test-results/f17/http-local.json",
  `${JSON.stringify({ capturedAt: new Date().toISOString(), passed: false, capacityVerified: false, status: "incomplete" })}\n`,
);
const env = localEnv();
const credentials = parse(readFileSync(env.E2E_CREDENTIALS_PATH));
const fixture = JSON.parse(readFileSync(env.E2E_SCENARIO_PATH, "utf8"));
const config = {
  mode: "local-smoke",
  origin: env.E2E_TENANT_BASE_URL,
  build: "development",
  phases: [
    { name: "warmup", users: 1, seconds: 30 },
    { name: "sustained", users: 1, seconds: 15 },
    { name: "burst", users: 2, seconds: 15 },
  ],
  pacingMs: 2000,
  timeoutMs: 60000,
  fixture: { courseId: fixture.courseId, lessonId: fixture.lessonId, positionSeconds: 30 },
  users: ["E2E_LEARNER", "E2E_ROLE_TARGET"].map((prefix) => ({
    email: credentials[`${prefix}_EMAIL`],
    password: credentials[`${prefix}_PASSWORD`],
  })),
};
try {
  const result = await runWorkload(config);
  mkdirSync(".test-results/f17", { recursive: true });
  writeFileSync(".test-results/f17/http-local.json", `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    JSON.stringify({
      passed: result.passed,
      capacityVerified: false,
      setup: result.setup,
      phases: result.phases.map((p) => ({
        name: p.name,
        requests: p.requests,
        journeys: p.journeys,
      })),
    }),
  );
  if (!result.passed) process.exitCode = 1;
} catch {
  console.error(
    "Local performance smoke could not complete. Check the isolated services and regenerated fixture manifest.",
  );
  process.exitCode = 1;
}
