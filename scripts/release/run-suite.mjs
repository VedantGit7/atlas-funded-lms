#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTOMATED_GATES,
  MANUAL_GATES,
  SCHEMA_VERSION,
  EVIDENCE_TYPE,
  GATE_PREREQUISITES,
  captureSource,
  deriveVerdict,
  gateBlockers,
} from "./evidence-contract.mjs";

const outputIndex = process.argv.indexOf("--output");
const outputPath =
  outputIndex === -1 ? join(process.cwd(), "release-evidence.json") : process.argv[outputIndex + 1];
const before = captureSource();
const skippedGroups = new Set(
  ["db", "build", "e2e"].filter((group) => process.argv.includes(`--skip-${group}`)),
);
const gates = AUTOMATED_GATES.map(({ id, name, script, severity, group }) => {
  const base = { id, name, kind: "automated", severity };
  let skipReason;
  if (before.errors.length) skipReason = "Source provenance could not be established";
  else if (skippedGroups.has(group)) skipReason = "Skipped by release suite flag";
  else if (group === "health" && !process.env.RELEASE_HEALTH_BASE_URL?.trim())
    skipReason = "RELEASE_HEALTH_BASE_URL not configured";
  else if (group === "restore" && !process.env.RESTORED_ENV_BASE_URL?.trim())
    skipReason = "RESTORED_ENV_BASE_URL not configured (manual isolated restore prerequisite)";
  if (skipReason) return { ...base, status: "skipped", message: skipReason };
  const missing = (GATE_PREREQUISITES[id] ?? []).filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    return {
      ...base,
      status: "failed",
      message: `Missing required gate prerequisites: ${missing.join(", ")}`,
    };
  }

  // Pass health configuration through the environment; do not interpolate a URL
  // into the Windows command shell. The health script reads this variable.
  const started = Date.now();
  const result = spawnSync("pnpm", [script], {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
    env:
      id === "db_rls_check"
        ? {
            ...process.env,
            DATABASE_URL: process.env.ATLAS_APP_LOGIN_URL,
            REQUIRE_NON_SUPERUSER_DB: "1",
          }
        : process.env,
  });
  const ok = result.status === 0 && !result.error;
  return {
    ...base,
    status: ok ? "passed" : "failed",
    command: `pnpm ${script}`,
    ...(ok
      ? {}
      : {
          message: (
            result.error?.message ||
            result.stderr ||
            result.stdout ||
            `exit ${result.status}`
          ).slice(0, 500),
        }),
    durationMs: Date.now() - started,
  };
});
const after = captureSource();
const sourceErrors = [...new Set([...before.errors, ...after.errors])];
if (before.source.headSha !== after.source.headSha)
  sourceErrors.push("HEAD changed during release suite");
const blockers = [...sourceErrors, ...gateBlockers(gates)];
const evidence = {
  schemaVersion: SCHEMA_VERSION,
  evidenceType: EVIDENCE_TYPE,
  storyId: "ATL-STORY-045",
  generatedAt: new Date().toISOString(),
  branch: process.env.GIT_BRANCH ?? undefined,
  commitSha: before.source.headSha,
  source: {
    ...before.source,
    clean:
      before.source.clean && after.source.clean && before.source.headSha === after.source.headSha,
  },
  environment: process.env.RELEASE_ENV ?? process.env.APP_ENV ?? "local",
  verdict: deriveVerdict(gates, blockers),
  productionApproved: false,
  gates: [
    ...gates,
    ...MANUAL_GATES.map((id) => ({
      id,
      name: id.replaceAll("_", " "),
      kind: "manual",
      severity: "P0",
      status: "manual_required",
      message: "Requires human sign-off before production review",
    })),
  ],
  manualGatesRequired: [...MANUAL_GATES],
  blockers,
  warnings: gates
    .filter((gate) => gate.severity === "P1" && gate.status === "failed")
    .map((gate) => `${gate.id}: ${gate.message ?? "failed"}`),
  rollbackTarget: process.env.RELEASE_SHA?.trim() || process.env.RELEASE_VERSION?.trim() || null,
};
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));
process.exit(evidence.verdict === "NOT_READY" ? 1 : 0);
