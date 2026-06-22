import { describe, expect, it } from "vitest";
import { buildApplyPlan, loadTenantManifest } from "@atlas/tenant-config";

describe("tenant config apply plan", () => {
  it("plans without mutation for production-plan-only", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    const plan = buildApplyPlan(manifest, "production", { productionPlanOnly: true });
    expect(plan.steps.every((step) => step.mutates === false)).toBe(true);
    expect(plan.warnings.some((warning) => warning.includes("refused"))).toBe(true);
  });

  it("includes legal gate skip when approval is pending", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    const plan = buildApplyPlan(manifest, "test");
    const readinessStep = plan.steps.find((step) => step.phase === "readiness");
    expect(readinessStep?.action).toBe("skipReadinessPublish");
    expect(plan.warnings.some((warning) => warning.includes("pending_approval"))).toBe(true);
  });

  it("never includes certificate issue or notification steps", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    const plan = buildApplyPlan(manifest, "development");
    const actions = plan.steps.map((step) => step.action).join(" ");
    expect(actions).not.toMatch(
      /issueCertificate|sendNotification|publishScoringConfig|publishCertificate/,
    );
  });
});
