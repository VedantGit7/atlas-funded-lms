import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parse } from "yaml";
import { createRequire } from "node:module";

// Use the semver implementation already bundled with our direct Next dependency.
const require = createRequire(import.meta.url);
const { satisfies } = createRequire(require.resolve("next/package.json"))(
  "./dist/compiled/semver",
) as {
  satisfies(version: string, range: string): boolean;
};

const root = resolve(import.meta.dirname, "../..");
const contract = JSON.parse(readFileSync(join(root, "scripts/ci/required-jobs.json"), "utf8")) as {
  requiredJobs: string[];
  optionalJobs: string[];
};
const directory = mkdtempSync(join(tmpdir(), "atlas-f09-gate-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
writeFileSync(join(directory, ".gitignore"), "evidence-*.json\n");
const git = (args: string[]) =>
  execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: "pipe" }).trim();
git(["init"]);
git(["add", "."]);
git([
  "-c",
  "user.name=CI gate fixture",
  "-c",
  "user.email=ci@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "--no-verify",
  "-m",
  "fixture",
]);
const sha = git(["rev-parse", "HEAD"]);
function runGate(overrides: Record<string, unknown> = {}, env: Record<string, string> = {}) {
  const needs: Record<string, unknown> = Object.fromEntries(
    contract.requiredJobs.map((id) => [id, { result: "success" }]),
  );
  needs["release-health-check"] = { result: "skipped" };
  Object.assign(needs, overrides);
  for (const key of Object.keys(needs)) if (needs[key] === null) Reflect.deleteProperty(needs, key);
  const output = join(directory, `evidence-${crypto.randomUUID()}.json`);
  const result = spawnSync(process.execPath, [join(root, "scripts/ci/write-ci-evidence.mjs")], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      CI_NEEDS_JSON: JSON.stringify(needs),
      CI_EVIDENCE_PATH: output,
      GITHUB_SHA: sha,
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_REPOSITORY: "VedantGit7/atlas-funded-lms",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_ACTIONS: "true",
      ...env,
    },
  });
  return { result, evidence: () => JSON.parse(readFileSync(output, "utf8")) };
}
describe("aggregate CI gate", () => {
  it("rejects an uncommitted checkout", () => {
    const dirty = join(directory, "dirty.txt");
    writeFileSync(dirty, "not committed");
    try {
      const run = runGate();
      expect(run.result.status).not.toBe(0);
      expect(run.evidence().blockers.join(" ")).toContain("dirty");
    } finally {
      rmSync(dirty);
    }
  });
  it("records the candidate/run and passes only complete success", () => {
    const run = runGate();
    expect(run.result.status, run.result.stderr).toBe(0);
    expect(run.evidence()).toMatchObject({
      commitSha: sha,
      verdict: "CI_PASSED",
      productionApproved: false,
      run: { id: "123", attempt: "1" },
    });
  });
  it.each(["failure", "cancelled", "skipped", "pending", "unknown"])(
    "fails closed for a %s security/event job",
    (status) => {
      const run = runGate({ "static-suite-tests": { result: status } });
      expect(run.result.status).not.toBe(0);
      expect(run.evidence()).toMatchObject({ verdict: "NOT_READY" });
      expect(run.evidence().blockers.join(" ")).toContain("static-suite-tests");
    },
  );
  it.each(["audit-metadata-check", "package-exports-check", "outbox-worker-check", "build"])(
    "rejects missing %s",
    (id) => {
      const run = runGate({ [id]: null });
      expect(run.result.status).not.toBe(0);
      expect(run.evidence().blockers.join(" ")).toContain(id);
    },
  );
  it("rejects a configured health job failure and any unknown job", () => {
    for (const change of [
      { "release-health-check": { result: "failure" } },
      { "forgotten-new-test": { result: "success" } },
    ]) {
      const run = runGate(change);
      expect(run.result.status).not.toBe(0);
      expect(run.evidence().verdict).toBe("NOT_READY");
    }
  });
  it.each([
    { GITHUB_SHA: "" },
    { GITHUB_SHA: "a".repeat(40) },
    { GITHUB_RUN_ID: "" },
    { GITHUB_RUN_ATTEMPT: "" },
    { CI_NEEDS_JSON: "invalid" },
  ])("rejects invalid identity/input %j", (env) => {
    const run = runGate({}, env);
    expect(run.result.status).not.toBe(0);
    expect(run.evidence().verdict).toBe("NOT_READY");
  });
});
describe("workflow graph and supply chain", () => {
  const ci = parse(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"));
  const drills = parse(readFileSync(join(root, ".github/workflows/drills.yml"), "utf8"));
  it("uses one pinned Node runtime compatible with locked Linux CI dependencies", () => {
    const version = readFileSync(join(root, ".node-version"), "utf8").trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(satisfies(version, manifest.engines.node)).toBe(true);
    const lock = parse(readFileSync(join(root, "pnpm-lock.yaml"), "utf8")) as {
      packages: Record<string, { engines?: { node?: string }; os?: string[]; cpu?: string[] }>;
    };
    const incompatible = Object.entries(lock.packages)
      .filter(
        ([, pkg]) => (!pkg.os || pkg.os.includes("linux")) && (!pkg.cpu || pkg.cpu.includes("x64")),
      )
      .filter(([, pkg]) => pkg.engines?.node && !satisfies(version, pkg.engines.node))
      .map(([name, pkg]) => `${name}: ${pkg.engines?.node}`);
    expect(incompatible).toEqual([]);
    for (const workflow of [ci, drills]) {
      for (const job of Object.values(workflow.jobs) as Array<{
        steps: Array<{ uses?: string; with?: Record<string, string> }>;
      }>) {
        for (const step of job.steps.filter((entry) =>
          entry.uses?.startsWith("actions/setup-node@"),
        )) {
          expect(step.with?.["node-version-file"]).toBe(".node-version");
          expect(step.with?.["node-version"]).toBeUndefined();
        }
      }
    }
    const dockerfile = readFileSync(join(root, "deploy/managed-node/Dockerfile"), "utf8");
    const images = [...dockerfile.matchAll(/^FROM (node:\S+)/gm)].map((match) => match[1]);
    expect(images).toHaveLength(3);
    expect(images.every((image) => image === `node:${version}-bookworm-slim`)).toBe(true);
  });
  it("covers every job in one always-running aggregate check", () => {
    expect(
      Object.keys(ci.jobs)
        .filter((id) => id !== "ci-required")
        .sort(),
    ).toEqual([...contract.requiredJobs, ...contract.optionalJobs].sort());
    expect(ci.jobs["ci-required"]?.needs?.sort()).toEqual(
      [...contract.requiredJobs, ...contract.optionalJobs].sort(),
    );
    expect(ci.jobs["ci-required"]?.if).toBe("${{ always() }}");
  });
  it("build waits on all mandatory verification jobs", () => {
    expect(ci.jobs.build.needs.sort()).toEqual(
      contract.requiredJobs.filter((id) => id !== "build").sort(),
    );
  });
  it("applies load-harness fixtures and requires drill artifacts", () => {
    expect(
      drills.jobs["load-harness"].steps.some(
        (step: { run?: string }) => step.run === "pnpm db:seed:tenants -- --apply",
      ),
    ).toBe(true);
    for (const job of Object.values(drills.jobs) as Array<{
      steps: Array<{ uses?: string; with?: Record<string, string> }>;
    }>) {
      const upload = job.steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
      expect(upload?.with?.["if-no-files-found"]).toBe("error");
    }
  });
  it("has only supported workflow keys and pinned actions", () => {
    const keys = new Set([
      "name",
      "run-name",
      "on",
      "permissions",
      "env",
      "concurrency",
      "defaults",
      "jobs",
    ]);
    for (const workflow of [ci, drills]) {
      expect(Object.keys(workflow).filter((key) => !keys.has(key))).toEqual([]);
      for (const job of Object.values(workflow.jobs) as Array<{
        env?: unknown;
        steps: Array<{ uses?: string }>;
      }>) {
        expect(JSON.stringify(job.env ?? {})).not.toContain("env.CI_DATABASE_URL");
        for (const step of job.steps)
          if (step.uses) expect(step.uses).toMatch(/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/);
      }
    }
  });
  it("publishes fresh release and aggregate evidence even on failure", () => {
    for (const [id, path] of [
      ["release-evidence-validation", "release-evidence.json"],
      ["ci-required", "ci-evidence.json"],
    ]) {
      const upload = ci.jobs[id]?.steps.find((step: { uses?: string }) =>
        step.uses?.startsWith("actions/upload-artifact@"),
      );
      expect(upload).toMatchObject({
        if: "${{ always() }}",
        with: { path, "if-no-files-found": "error" },
      });
      expect(upload.with.name).toContain("github.sha");
      expect(upload.with.name).toContain("github.run_attempt");
    }
  });
  it("retains the specific browser failure-probe evidence from its hidden directory", () => {
    const upload = ci.jobs["browser-smoke"].steps.find((step: { uses?: string }) =>
      step.uses?.startsWith("actions/upload-artifact@"),
    );
    expect(upload.with["include-hidden-files"]).toBe(true);
    expect(upload.with.path.trim().split(/\s+/)).toEqual([
      "playwright-report/",
      ".test-results/f16-probes/evidence.json",
      // Runner memory samples, so a dropped-connection failure can be told apart from pressure.
      ".test-results/f16-resources/usage.log",
    ]);
  });
  it("configures the platform browser origin for the separate API server", () => {
    const browserEnv = ci.jobs["browser-smoke"].env;
    expect(browserEnv.E2E_PLATFORM_BASE_URL).toBeTruthy();
    expect(browserEnv.PLATFORM_HOST).toBe(new URL(browserEnv.E2E_PLATFORM_BASE_URL).hostname);
  });
  it("runs isolated security integration suites with their required local services", () => {
    for (const id of ["integration-tests", "release-evidence-validation"]) {
      const job = ci.jobs[id];
      for (const key of [
        "F03_TEST_DATABASE_URL",
        "F07_TEST_DATABASE_URL",
        "F08_TEST_DATABASE_URL",
        "F14_TEST_DATABASE_URL",
        "F15_TEST_DATABASE_URL",
        "F04_TEST_REDIS_URL",
      ])
        expect(job.env[key]).toBeTruthy();
      for (const key of ["F14_TEST_DATABASE_URL", "F15_TEST_DATABASE_URL"])
        expect(job.env[key]).toBe(job.env.DATABASE_URL);
      expect(job.services.redis).toBeTruthy();
    }
  });
});
