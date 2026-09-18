import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Phase 5 verification harnesses must be reachable from a workflow.
 *
 * Both were written to answer questions that had gone unanswered for the whole
 * programme — what the concurrency ceiling actually is, and whether a restore
 * has ever been performed. Neither belongs in per-push CI: a load test on a
 * shared runner measures the runner, and a restore drill on every commit is
 * noise. So both were initially referenced by nothing at all.
 *
 * That is the failure mode this codebase keeps producing. Six test suites ran in
 * no script and no CI job; four CI guards scanned zero files; a release-evidence
 * job asserted only that a file existed. In every case the artefact was present
 * and the guarantee was absent, and nothing noticed because presence is what
 * gets checked.
 *
 * So: a scheduled workflow runs them weekly, and this asserts the reference
 * exists. A harness nobody runs is indistinguishable from one that does not
 * work.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const workflowDir = join(repoRoot, ".github", "workflows");

function allWorkflowText(): string {
  return readdirSync(workflowDir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => readFileSync(join(workflowDir, f), "utf8"))
    .join("\n");
}

describe("verification harness wiring (Phase 5)", () => {
  const workflows = allWorkflowText();

  it("reads the workflow directory it is meant to be checking", () => {
    // Guards the guard: an empty read would make every assertion below vacuous.
    expect(workflows.length).toBeGreaterThan(1000);
    expect(workflows).toContain("pnpm install --frozen-lockfile");
  });

  it.each([
    ["restore drill", "release:restore:drill", "scripts/release/restore-drill.mjs"],
    ["load harness", "exam-window-load.ts", "scripts/perf/exam-window-load.ts"],
  ])("%s is referenced by a workflow and its script exists", (_label, reference, scriptPath) => {
    expect(workflows).toContain(reference);
    expect(() => readFileSync(join(repoRoot, scriptPath), "utf8")).not.toThrow();
  });

  it("runs the drills on a schedule, not only on demand", () => {
    // workflow_dispatch alone would mean "somebody remembers to click it",
    // which is the same as not running. A restore procedure first attempted
    // during an incident is not a procedure.
    const drills = readFileSync(join(workflowDir, "drills.yml"), "utf8");
    expect(drills).toMatch(/schedule:/);
    expect(drills).toMatch(/cron:/);
  });
});
