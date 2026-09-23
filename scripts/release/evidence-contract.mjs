import { execFileSync } from "node:child_process";

export const SCHEMA_VERSION = "2";
export const EVIDENCE_TYPE = "release-suite";
const DATABASE_TEST_ENV = ["DATABASE_URL", "PLATFORM_DATABASE_URL"];
// These suites conditionally skip without their services. Require explicit
// configuration before executing them; a successful process exit alone cannot
// prove a database or Redis suite actually ran.
export const GATE_PREREQUISITES = {
  integration_tests: [
    ...DATABASE_TEST_ENV,
    "F03_TEST_DATABASE_URL",
    "F07_TEST_DATABASE_URL",
    "F08_TEST_DATABASE_URL",
    "F04_TEST_REDIS_URL",
  ],
  authorization_tests: DATABASE_TEST_ENV,
  tenant_isolation_tests: [...DATABASE_TEST_ENV, "ATLAS_APP_LOGIN_URL"],
  rls_tests: DATABASE_TEST_ENV,
  storage_tests: DATABASE_TEST_ENV,
  e2e_tests: DATABASE_TEST_ENV,
  db_migrate_check: ["DATABASE_URL"],
  db_rls_check: ["ATLAS_APP_LOGIN_URL"],
};
export const MANUAL_GATES = [
  "legal_readiness",
  "monitoring_alerts",
  "backup_restore_drill",
  "rollback_target",
  "domain_ssl",
  "production_secrets_review",
  "incident_owner",
  "cto_approval",
];

// This is the full suite contract. Optional environment checks remain visible;
// their absence is not evidence of production readiness or human approval.
export const AUTOMATED_GATES = [
  ["format_check", "Format check", "format:check"],
  ["lint", "Lint", "lint"],
  ["typecheck", "Typecheck", "typecheck"],
  ["route_metadata", "Route metadata", "ci:route-metadata"],
  ["zod_boundaries", "Zod API boundaries", "ci:zod-boundaries"],
  ["permission_metadata", "Permission metadata", "ci:permission-metadata"],
  ["entitlement_metadata", "Entitlement metadata", "ci:entitlement-metadata", "P1"],
  ["prisma_boundary", "Prisma import boundary", "ci:prisma-boundary"],
  ["audit_metadata", "Audit obligations", "ci:audit-metadata"],
  ["outbox_metadata", "Outbox obligations", "ci:outbox-metadata"],
  ["forbidden_scope", "Forbidden product scope", "ci:forbidden-scope"],
  ["tenant_resource_registry", "Tenant resource IDOR registry", "ci:tenant-resource-registry"],
  ["security_check", "Security regression bundle", "security:check"],
  ["unit_tests", "Unit tests", "test:unit"],
  ["integration_tests", "Integration tests", "test:integration", "P0", "db"],
  ["authorization_tests", "Authorization matrix", "test:authorization"],
  ["tenant_isolation_tests", "Tenant isolation", "test:tenant-isolation", "P0", "db"],
  ["rls_tests", "RLS state check", "test:rls", "P0", "db"],
  ["worker_tests", "Worker/event pipeline", "test:workers", "P1"],
  ["storage_tests", "Storage policy", "test:storage", "P1"],
  ["e2e_tests", "E2E wiring suite", "test:e2e", "P0", "e2e"],
  ["tenant_config_validate", "Tenant config manifests", "db:seed:check", "P0", "db"],
  ["db_migrate_check", "Migration status", "db:migrate:check", "P0", "db"],
  ["db_rls_check", "RLS policies", "db:rls:check", "P0", "db"],
  ["db_seed_check", "Seed/config check", "db:seed:check", "P1", "db"],
  ["build", "Production build", "build", "P0", "build"],
  ["observability_contract", "Observability contract", "observability:check", "P1"],
  ["release_health", "Staging release health", "release:health", "P1", "health"],
  [
    "restore_validation",
    "Restored environment validation",
    "release:restore:validate",
    "P1",
    "restore",
  ],
].map(([id, name, script, severity = "P0", group]) => ({
  id,
  name,
  script,
  severity,
  group,
  kind: "automated",
  optional: group === "health" || group === "restore",
}));
export const EXPECTED_GATES = [
  ...AUTOMATED_GATES,
  ...MANUAL_GATES.map((id) => ({ id, kind: "manual", severity: "P0" })),
];
export const SHA_PATTERN = /^[a-f0-9]{40}$/;
export const RUN_ID_PATTERN = /^[1-9][0-9]*$/;

export function captureSource(env = process.env) {
  const errors = [];
  let headSha = null;
  let clean = false;
  try {
    headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
    clean =
      execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
        encoding: "utf8",
        stdio: "pipe",
      }).trim() === "";
    if (!SHA_PATTERN.test(headSha)) errors.push("HEAD is not a full commit SHA");
    if (!clean) errors.push("Checkout is dirty; evidence is not proof of the committed candidate");
  } catch {
    errors.push("Cannot establish Git HEAD and checkout cleanliness");
  }
  for (const key of ["GIT_SHA", "GITHUB_SHA"]) {
    if (env[key] !== undefined && env[key] !== headSha)
      errors.push(`${key} does not match actual HEAD`);
  }
  const ci = [env.CI, env.GITHUB_ACTIONS].some(
    (value) => value && value !== "false" && value !== "0",
  );
  const ciRunId = ci ? (env.GITHUB_RUN_ID ?? null) : null;
  const ciRunAttempt = ci ? (env.GITHUB_RUN_ATTEMPT ?? null) : null;
  if (ci && (!RUN_ID_PATTERN.test(ciRunId ?? "") || !RUN_ID_PATTERN.test(ciRunAttempt ?? ""))) {
    errors.push("CI evidence requires GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT");
  }
  return { source: { headSha, clean, ci, ciRunId, ciRunAttempt }, errors };
}

export function gateBlockers(gates) {
  return gates.flatMap((gate) => {
    const expected = AUTOMATED_GATES.find(({ id }) => id === gate.id);
    if (!expected) return [];
    if (gate.status === "passed" || (expected.optional && gate.status === "skipped")) return [];
    return [`${gate.id}: ${gate.status}`];
  });
}

export function deriveVerdict(gates, blockers = []) {
  if (blockers.length || gateBlockers(gates).length) return "NOT_READY";
  return gates.find(({ id }) => id === "release_health")?.status === "passed"
    ? "READY_FOR_PRODUCTION_REVIEW"
    : "READY_FOR_STAGING";
}
