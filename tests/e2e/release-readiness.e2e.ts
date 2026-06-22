import { describe, expect, it } from "vitest";
import {
  buildTenantResourceRegistry,
  evaluateReleaseEvidence,
  listAutomatedGateDefinitions,
  validateTenantResourceRegistryCoverage,
} from "@atlas/release-readiness";

describe("release readiness integrated suite", () => {
  it("defines automated gate catalogue for ATL-STORY-045", () => {
    const gates = listAutomatedGateDefinitions();
    expect(gates.some((gate) => gate.id === "tenant_resource_registry")).toBe(true);
    expect(gates.some((gate) => gate.id === "security_check")).toBe(true);
    expect(gates.some((gate) => gate.id === "e2e_tests")).toBe(true);
  });

  it("tenant resource registry is complete for P0/P1 IDOR surfaces", () => {
    const entries = buildTenantResourceRegistry();
    const report = validateTenantResourceRegistryCoverage(entries);
    expect(report.ok).toBe(true);
  });

  it("evaluator never emits production approval", () => {
    const evidence = evaluateReleaseEvidence({
      automatedGates: [],
      stagingHealthPassed: true,
    });

    expect(evidence.productionApproved).toBe(false);
    expect(evidence.manualGatesRequired).toContain("cto_approval");
    expect(["NOT_READY", "READY_FOR_STAGING", "READY_FOR_PRODUCTION_REVIEW"]).toContain(
      evidence.verdict,
    );
  });
});
