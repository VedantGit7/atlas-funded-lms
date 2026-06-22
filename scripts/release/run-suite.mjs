#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

const outputPath = readArg("output") ?? join(process.cwd(), "release-evidence.json");
const skipDb = process.argv.includes("--skip-db");
const skipBuild = process.argv.includes("--skip-build");
const skipE2E = process.argv.includes("--skip-e2e");

function runCommand(id, name, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
  const durationMs = Date.now() - started;
  const ok = result.status === 0;

  return {
    id,
    name,
    kind: "automated",
    severity: options.severity ?? "P0",
    status: options.skip ? "skipped" : ok ? "passed" : "failed",
    command: `${command} ${args.join(" ")}`.trim(),
    message: ok
      ? undefined
      : (result.stderr || result.stdout || `exit ${result.status}`).slice(0, 500),
    durationMs,
  };
}

function gate(id, name, script, severity = "P0", skip = false) {
  if (skip) {
    return {
      id,
      name,
      kind: "automated",
      severity,
      status: "skipped",
      message: "Skipped by release suite flag",
    };
  }

  return runCommand(id, name, "pnpm", [script], { severity });
}

const gates = [];

gates.push(gate("format_check", "Format check", "format:check"));
gates.push(gate("lint", "Lint", "lint"));
gates.push(gate("typecheck", "Typecheck", "typecheck"));
gates.push(gate("route_metadata", "Route metadata", "ci:route-metadata"));
gates.push(gate("zod_boundaries", "Zod API boundaries", "ci:zod-boundaries"));
gates.push(gate("permission_metadata", "Permission metadata", "ci:permission-metadata"));
gates.push(gate("entitlement_metadata", "Entitlement metadata", "ci:entitlement-metadata", "P1"));
gates.push(gate("prisma_boundary", "Prisma import boundary", "ci:prisma-boundary"));
gates.push(gate("audit_metadata", "Audit obligations", "ci:audit-metadata"));
gates.push(gate("outbox_metadata", "Outbox obligations", "ci:outbox-metadata"));
gates.push(gate("forbidden_scope", "Forbidden product scope", "ci:forbidden-scope"));
gates.push(
  gate("tenant_resource_registry", "Tenant resource IDOR registry", "ci:tenant-resource-registry"),
);
gates.push(gate("security_check", "Security regression bundle", "security:check"));
gates.push(gate("unit_tests", "Unit tests", "test:unit"));
gates.push(gate("integration_tests", "Integration tests", "test:integration", "P0", skipDb));
gates.push(gate("authorization_tests", "Authorization matrix", "test:authorization"));
gates.push(
  gate("tenant_isolation_tests", "Tenant isolation", "test:tenant-isolation", "P0", skipDb),
);
gates.push(gate("rls_tests", "RLS state check", "test:rls", "P0", skipDb));
gates.push(gate("worker_tests", "Worker/event pipeline", "test:workers", "P1"));
gates.push(gate("storage_tests", "Storage policy", "test:storage", "P1"));
gates.push(gate("e2e_tests", "E2E wiring suite", "test:e2e", "P0", skipE2E));
gates.push(
  gate("tenant_config_validate", "Tenant config manifests", "db:seed:check", "P0", skipDb),
);
gates.push(gate("db_migrate_check", "Migration status", "db:migrate:check", "P0", skipDb));
gates.push(gate("db_rls_check", "RLS policies", "db:rls:check", "P0", skipDb));
gates.push(gate("db_seed_check", "Seed/config check", "db:seed:check", "P1", skipDb));
gates.push(gate("build", "Production build", "build", "P0", skipBuild));
gates.push(gate("observability_contract", "Observability contract", "observability:check", "P1"));

const releaseHealthUrl = process.env.RELEASE_HEALTH_BASE_URL?.trim();
if (releaseHealthUrl) {
  gates.push(
    runCommand(
      "release_health",
      "Staging release health",
      "pnpm",
      ["release:health", "--", "--base-url", releaseHealthUrl],
      { severity: "P1" },
    ),
  );
} else {
  gates.push({
    id: "release_health",
    name: "Staging release health",
    kind: "automated",
    severity: "P1",
    status: "skipped",
    message: "RELEASE_HEALTH_BASE_URL not configured",
  });
}

const restoredBaseUrl = process.env.RESTORED_ENV_BASE_URL?.trim();
if (restoredBaseUrl) {
  gates.push(
    runCommand(
      "restore_validation",
      "Restored environment validation",
      "pnpm",
      ["release:restore:validate"],
      { severity: "P1" },
    ),
  );
} else {
  gates.push({
    id: "restore_validation",
    name: "Restored environment validation",
    kind: "automated",
    severity: "P1",
    status: "skipped",
    message: "RESTORED_ENV_BASE_URL not configured (manual isolated restore prerequisite)",
  });
}

const automatedP0Failures = gates.filter(
  (gate) => gate.severity === "P0" && gate.status === "failed",
);
const launchCriticalP1Failures = gates.filter(
  (gate) =>
    gate.severity === "P1" &&
    gate.status === "failed" &&
    ["release_health", "restore_validation", "worker_tests", "storage_tests"].includes(gate.id),
);

let verdict = "NOT_READY";
if (automatedP0Failures.length === 0 && launchCriticalP1Failures.length === 0) {
  verdict = "READY_FOR_STAGING";
}
const releaseHealthPassed = gates.find((gate) => gate.id === "release_health")?.status === "passed";
if (
  releaseHealthPassed &&
  automatedP0Failures.length === 0 &&
  launchCriticalP1Failures.length === 0
) {
  verdict = "READY_FOR_PRODUCTION_REVIEW";
}

const evidence = {
  schemaVersion: "1",
  storyId: "ATL-STORY-045",
  generatedAt: new Date().toISOString(),
  branch: process.env.GIT_BRANCH ?? undefined,
  commitSha: process.env.GIT_SHA ?? undefined,
  environment: process.env.RELEASE_ENV ?? process.env.APP_ENV ?? "local",
  verdict,
  productionApproved: false,
  gates: [
    ...gates,
    ...[
      "legal_readiness",
      "monitoring_alerts",
      "backup_restore_drill",
      "rollback_target",
      "domain_ssl",
      "production_secrets_review",
      "incident_owner",
      "cto_approval",
    ].map((id) => ({
      id,
      name: id.replaceAll("_", " "),
      kind: "manual",
      severity: "P0",
      status: "manual_required",
      message: "Requires human sign-off before production review",
    })),
  ],
  manualGatesRequired: [
    "legal_readiness",
    "monitoring_alerts",
    "backup_restore_drill",
    "rollback_target",
    "domain_ssl",
    "production_secrets_review",
    "incident_owner",
    "cto_approval",
  ],
  blockers: [
    ...automatedP0Failures.map((gate) => `${gate.id}: ${gate.message ?? "failed"}`),
    ...launchCriticalP1Failures.map((gate) => `P1 launch-critical: ${gate.id}`),
  ],
  warnings: gates
    .filter((gate) => gate.severity === "P1" && gate.status === "failed")
    .map((gate) => `${gate.id}: ${gate.message ?? "failed"}`),
  rollbackTarget: process.env.RELEASE_SHA?.trim() || process.env.RELEASE_VERSION?.trim() || null,
};

writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence, null, 2));

const exitCode = verdict === "NOT_READY" ? 1 : 0;
process.exit(exitCode);
