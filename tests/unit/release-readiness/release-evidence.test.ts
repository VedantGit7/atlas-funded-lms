import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type MutableEvidence = Record<string, unknown> & {
  source: Record<string, unknown>;
  gates: Record<string, unknown>[];
};
const scripts = resolve("scripts/release");
const automated = [
  "format_check",
  "lint",
  "typecheck",
  "route_metadata",
  "zod_boundaries",
  "permission_metadata",
  "entitlement_metadata",
  "prisma_boundary",
  "audit_metadata",
  "outbox_metadata",
  "forbidden_scope",
  "tenant_resource_registry",
  "security_check",
  "unit_tests",
  "integration_tests",
  "authorization_tests",
  "tenant_isolation_tests",
  "rls_tests",
  "worker_tests",
  "storage_tests",
  "e2e_tests",
  "tenant_config_validate",
  "db_migrate_check",
  "db_rls_check",
  "db_seed_check",
  "build",
  "observability_contract",
  "release_health",
  "restore_validation",
];
const p1 = new Set([
  "entitlement_metadata",
  "worker_tests",
  "storage_tests",
  "db_seed_check",
  "observability_contract",
  "release_health",
  "restore_validation",
]);
const manual = [
  "legal_readiness",
  "monitoring_alerts",
  "backup_restore_drill",
  "rollback_target",
  "domain_ssl",
  "production_secrets_review",
  "incident_owner",
  "cto_approval",
];
let directory: string;
let sha: string;
let env: NodeJS.ProcessEnv;

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "atlas-release-evidence-"));
  mkdirSync(join(directory, "bin"));
  writeFileSync(join(directory, ".gitignore"), "result.json\n*.log\n");
  writeFileSync(join(directory, "source.txt"), "candidate\n");
  writeFileSync(
    join(directory, "bin", "pnpm.cmd"),
    '@echo off\r\necho %1>>commands.log\r\nif "%1"=="db:rls:check" echo %DATABASE_URL% %REQUIRE_NON_SUPERUSER_DB% >>rls.log\r\nif "%1"=="%MUTATE_GATE%" echo changed>source.txt\r\nif "%1"=="%FAIL_GATE%" exit /b 1\r\nexit /b 0\r\n',
  );
  writeFileSync(
    join(directory, "bin", "pnpm"),
    '#!/bin/sh\necho "$1" >> commands.log\nif [ "$1" = "db:rls:check" ]; then echo "$DATABASE_URL $REQUIRE_NON_SUPERUSER_DB" >> rls.log; fi\nif [ "$1" = "$MUTATE_GATE" ]; then echo changed > source.txt; fi\n[ "$1" != "$FAIL_GATE" ]\n',
    { mode: 0o755 },
  );
  env = { ...process.env, PATH: `${join(directory, "bin")}${delimiter}${process.env.PATH}` };
  for (const key of Object.keys(env)) {
    if (
      /DATABASE|DB_URL|DIRECT_URL|ATLAS_APP_LOGIN_URL|GIT_SHA|GITHUB_|^CI$|RELEASE_|RESTORED_|FAIL_GATE|MUTATE_GATE/.test(
        key,
      )
    )
      Reflect.deleteProperty(env, key);
  }
  // These are passed only to the fake package runner; no database client runs.
  Object.assign(env, {
    DATABASE_URL: "postgresql://admin:test@127.0.0.1:1/release_fixture",
    PLATFORM_DATABASE_URL: "postgresql://platform:test@127.0.0.1:1/release_fixture",
    ATLAS_APP_LOGIN_URL: "postgresql://app:test@127.0.0.1:1/release_fixture",
    F03_TEST_DATABASE_URL: "postgresql://admin:test@127.0.0.1:1/f03_fixture",
    F07_TEST_DATABASE_URL: "postgresql://admin:test@127.0.0.1:1/f07_fixture",
    F08_TEST_DATABASE_URL: "postgresql://admin:test@127.0.0.1:1/f08_fixture",
    F04_TEST_REDIS_URL: "redis://127.0.0.1:1/15",
  });
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: directory, env, encoding: "utf8", stdio: "pipe" }).trim();
  git(["init"]);
  git(["add", "."]);
  git([
    "-c",
    "user.name=Evidence test",
    "-c",
    "user.email=evidence@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--no-verify",
    "-m",
    "fixture",
  ]);
  sha = git(["rev-parse", "HEAD"]);
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function validEvidence() {
  return {
    schemaVersion: "2",
    evidenceType: "release-suite",
    storyId: "ATL-STORY-045",
    generatedAt: new Date().toISOString(),
    commitSha: sha,
    environment: "test",
    source: { headSha: sha, clean: true, ci: false, ciRunId: null, ciRunAttempt: null },
    verdict: "READY_FOR_STAGING",
    productionApproved: false,
    gates: [
      ...automated.map((id) => ({
        id,
        name: id,
        kind: "automated",
        severity: p1.has(id) ? "P1" : "P0",
        status: ["release_health", "restore_validation"].includes(id) ? "skipped" : "passed",
      })),
      ...manual.map((id) => ({
        id,
        name: id,
        kind: "manual",
        severity: "P0",
        status: "manual_required",
      })),
    ],
    manualGatesRequired: [...manual],
    blockers: [],
    warnings: [],
    rollbackTarget: null,
  };
}
function validate(evidence: unknown, extraEnv: NodeJS.ProcessEnv = {}) {
  writeFileSync(join(directory, "result.json"), JSON.stringify(evidence));
  return spawnSync(process.execPath, [join(scripts, "validate-evidence.mjs")], {
    cwd: directory,
    env: { ...env, RELEASE_EVIDENCE_PATH: "result.json", ...extraEnv },
    encoding: "utf8",
  });
}
function run(extraEnv: NodeJS.ProcessEnv = {}, args: string[] = []) {
  writeFileSync(join(directory, "commands.log"), "");
  writeFileSync(join(directory, "rls.log"), "");
  const result = spawnSync(
    process.execPath,
    [join(scripts, "run-suite.mjs"), "--output", "result.json", ...args],
    { cwd: directory, env: { ...env, ...extraEnv }, encoding: "utf8", timeout: 60_000 },
  );
  return { result, evidence: JSON.parse(readFileSync(join(directory, "result.json"), "utf8")) };
}

describe("release evidence validator", () => {
  it("accepts a complete fresh staging candidate with explicit optional and manual gates", () => {
    expect(validate(validEvidence()).status).toBe(0);
  });
  it.each([
    ["missing SHA", (e: MutableEvidence) => delete e.commitSha],
    ["empty gates", (e: MutableEvidence) => (e.gates = [])],
    ["missing gate", (e: MutableEvidence) => e.gates.pop()],
    ["duplicate gate", (e: MutableEvidence) => e.gates.push(e.gates[0])],
    ["unknown gate", (e: MutableEvidence) => (e.gates[0].id = "invented")],
    ["unknown status", (e: MutableEvidence) => (e.gates[0].status = "success")],
    ["unknown kind", (e: MutableEvidence) => (e.gates[0].kind = "other")],
    ["downgraded severity", (e: MutableEvidence) => (e.gates[0].severity = "P1")],
    [
      "manual spoof",
      (e: MutableEvidence) =>
        Object.assign(e.gates[0], { kind: "manual", status: "manual_required" }),
    ],
    ["signed-off manual spoof", (e: MutableEvidence) => (e.gates.at(-1).status = "passed")],
    ["unknown schema", (e: MutableEvidence) => (e.schemaVersion = "999")],
    ["unknown verdict", (e: MutableEvidence) => (e.verdict = "APPROVED")],
    ["not ready verdict", (e: MutableEvidence) => (e.verdict = "NOT_READY")],
    [
      "unsupported production review",
      (e: MutableEvidence) => (e.verdict = "READY_FOR_PRODUCTION_REVIEW"),
    ],
    [
      "production approval",
      (e: MutableEvidence) => {
        e.verdict = "READY_FOR_PRODUCTION_REVIEW";
        e.productionApproved = true;
      },
    ],
    [
      "future timestamp",
      (e: MutableEvidence) => (e.generatedAt = new Date(Date.now() + 3600_000).toISOString()),
    ],
    [
      "stale timestamp",
      (e: MutableEvidence) => (e.generatedAt = new Date(Date.now() - 48 * 3600_000).toISOString()),
    ],
    ["missing provenance", (e: MutableEvidence) => Reflect.deleteProperty(e, "source")],
    ["dirty provenance", (e: MutableEvidence) => (e.source.clean = false)],
    ["missing manual requirements", (e: MutableEvidence) => (e.manualGatesRequired = [])],
    ["null gate", (e: MutableEvidence) => Reflect.set(e.gates, 0, null)],
    [
      "failed P1",
      (e: MutableEvidence) =>
        (e.gates.find((g) => g.id === "observability_contract").status = "failed"),
    ],
    [
      "skipped required P1",
      (e: MutableEvidence) =>
        (e.gates.find((g) => g.id === "observability_contract").status = "skipped"),
    ],
    ["unknown top-level field", (e: MutableEvidence) => (e.approved = true)],
    ["unknown provenance field", (e: MutableEvidence) => (e.source.dirtyOverride = true)],
    ["invalid gate duration", (e: MutableEvidence) => (e.gates[0].durationMs = -1)],
    ["unknown gate field", (e: MutableEvidence) => (e.gates[0].approved = true)],
  ])("rejects %s", (_name, mutate) => {
    const evidence = validEvidence();
    mutate(evidence as unknown as MutableEvidence);
    const result = validate(evidence);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Release evidence validation FAILED");
  });
  it.each(["NaN", "0", "-1", "Infinity"])("rejects invalid max age %s", (age) => {
    expect(validate(validEvidence(), { RELEASE_EVIDENCE_MAX_AGE_HOURS: age }).status).toBe(1);
  });
  it("does not let an environment SHA override the checkout", () => {
    const evidence = validEvidence();
    evidence.commitSha = "a".repeat(40);
    expect(validate(evidence, { GIT_SHA: evidence.commitSha }).status).toBe(1);
  });
  it("requires CI run identity for CI evidence", () => {
    expect(
      validate(validEvidence(), { CI: "true", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" })
        .status,
    ).toBe(1);
  });
});

describe("release suite generator", () => {
  it.each([
    "DATABASE_URL",
    "PLATFORM_DATABASE_URL",
    "F03_TEST_DATABASE_URL",
    "F07_TEST_DATABASE_URL",
    "F08_TEST_DATABASE_URL",
    "F04_TEST_REDIS_URL",
  ])("blocks integration before command execution without %s", (key) => {
    const { result, evidence } = run({ [key]: undefined });
    expect(result.status).toBe(1);
    expect(evidence.verdict).toBe("NOT_READY");
    expect(
      evidence.gates.find((gate: { id: string }) => gate.id === "integration_tests"),
    ).toMatchObject({ status: "failed", message: expect.stringContaining(key) });
    expect(readFileSync(join(directory, "commands.log"), "utf8").split(/\r?\n/)).not.toContain(
      "test:integration",
    );
  });
  it.each(["DATABASE_URL", "PLATFORM_DATABASE_URL"])(
    "blocks all database-backed test families without %s",
    (key) => {
      const { evidence } = run({ [key]: " " });
      for (const id of [
        "authorization_tests",
        "tenant_isolation_tests",
        "rls_tests",
        "storage_tests",
        "e2e_tests",
      ]) {
        expect(evidence.gates.find((gate: { id: string }) => gate.id === id)).toMatchObject({
          status: "failed",
          message: expect.stringContaining(key),
        });
      }
      if (key === "DATABASE_URL")
        expect(
          evidence.gates.find((gate: { id: string }) => gate.id === "db_migrate_check").status,
        ).toBe("failed");
    },
  );
  it("requires the restricted login for tenant isolation and the RLS policy check", () => {
    const { result, evidence } = run({ ATLAS_APP_LOGIN_URL: undefined });
    expect(result.status).toBe(1);
    for (const id of ["tenant_isolation_tests", "db_rls_check"]) {
      expect(evidence.gates.find((gate: { id: string }) => gate.id === id)).toMatchObject({
        status: "failed",
        message: expect.stringContaining("ATLAS_APP_LOGIN_URL"),
      });
    }
    expect(readFileSync(join(directory, "commands.log"), "utf8").split(/\r?\n/)).not.toContain(
      "db:rls:check",
    );
  });
  it("enforces the restricted login for the RLS policy command", () => {
    expect(run().result.status).toBe(0);
    expect(readFileSync(join(directory, "rls.log"), "utf8").trim()).toBe(
      `${env.ATLAS_APP_LOGIN_URL} 1`,
    );
  });
  it("emits valid complete evidence from a clean isolated candidate", () => {
    const { result, evidence } = run();
    expect(result.status, result.stderr).toBe(0);
    expect(evidence.source).toMatchObject({ clean: true, headSha: sha });
    expect(evidence.productionApproved).toBe(false);
    expect(validate(evidence).status).toBe(0);
  });
  it.each(["ci:entitlement-metadata", "observability:check"])(
    "blocks staging for failed P1 %s while preserving evidence",
    (script) => {
      const { result, evidence } = run({ FAIL_GATE: script });
      expect(result.status).toBe(1);
      expect(evidence.verdict).toBe("NOT_READY");
      expect(evidence.blockers.length).toBeGreaterThan(0);
    },
  );
  it("writes non-ready evidence for a dirty checkout", () => {
    writeFileSync(join(directory, "source.txt"), "uncommitted candidate\n");
    try {
      const { result, evidence } = run();
      expect(result.status).toBe(1);
      expect(evidence.verdict).toBe("NOT_READY");
      expect(evidence.source.clean).toBe(false);
    } finally {
      writeFileSync(join(directory, "source.txt"), "candidate\n");
    }
  });
  it("rejects a mismatched environment commit but still records actual HEAD", () => {
    const { result, evidence } = run({ GIT_SHA: "b".repeat(40) });
    expect(result.status).toBe(1);
    expect(evidence.commitSha).toBe(sha);
    expect(evidence.verdict).toBe("NOT_READY");
  });
  it("requires stable CI run identity", () => {
    const { result, evidence } = run({ CI: "true" });
    expect(result.status).toBe(1);
    expect(evidence.verdict).toBe("NOT_READY");
  });
  it("records and validates CI run and attempt", () => {
    const ci = { CI: "true", GITHUB_SHA: sha, GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2" };
    const { result, evidence } = run(ci);
    expect(result.status).toBe(0);
    expect(evidence.source).toMatchObject({ ci: true, ciRunId: "123", ciRunAttempt: "2" });
    expect(validate(evidence, ci).status).toBe(0);
    expect(validate(evidence, { ...ci, GITHUB_RUN_ATTEMPT: "3" }).status).toBe(1);
  });
  it("keeps skipped required checks visibly non-ready", () => {
    const { result, evidence } = run({}, ["--skip-db", "--skip-build", "--skip-e2e"]);
    expect(result.status).toBe(1);
    expect(evidence.blockers.some((b: string) => b.includes("skipped"))).toBe(true);
  });
  it("detects source changes during commands", () => {
    try {
      const { result, evidence } = run({ MUTATE_GATE: "observability:check" });
      expect(result.status).toBe(1);
      expect(evidence.source.clean).toBe(false);
      expect(evidence.verdict).toBe("NOT_READY");
    } finally {
      writeFileSync(join(directory, "source.txt"), "candidate\n");
    }
  });
  it("blocks an untracked source file but permits ignored generated artifacts", () => {
    writeFileSync(join(directory, "candidate.log"), "generated output\n");
    writeFileSync(join(directory, "untracked.ts"), "export const changed = true;\n");
    try {
      expect(run().result.status).toBe(1);
    } finally {
      rmSync(join(directory, "untracked.ts"));
    }
    expect(run().result.status).toBe(0);
  });
  it("permits production review after health passes while retaining manual sign-offs", () => {
    const { result, evidence } = run({
      RELEASE_HEALTH_BASE_URL: "https://staging.example.invalid",
    });
    expect(result.status).toBe(0);
    expect(evidence.verdict).toBe("READY_FOR_PRODUCTION_REVIEW");
    expect(evidence.productionApproved).toBe(false);
    expect(evidence.manualGatesRequired).toEqual(manual);
    expect(validate(evidence).status).toBe(0);
  });
  it.each([
    ["release:health", { RELEASE_HEALTH_BASE_URL: "https://staging.example.invalid" }],
    ["release:restore:validate", { RESTORED_ENV_BASE_URL: "https://restored.example.invalid" }],
  ])("blocks a configured optional check when it fails: %s", (script, config) => {
    const { result, evidence } = run({ ...config, FAIL_GATE: script });
    expect(result.status).toBe(1);
    expect(evidence.verdict).toBe("NOT_READY");
  });
});
