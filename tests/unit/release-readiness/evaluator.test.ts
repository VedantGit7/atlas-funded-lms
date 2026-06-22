import { describe, expect, it } from "vitest";
import {
  assertNeverAutoApprovesProduction,
  evaluateReleaseEvidence,
  parseReleaseEvidence,
  safeParseReleaseEvidence,
} from "@atlas/release-readiness";

describe("release evidence schema", () => {
  it("parses valid evidence and rejects production approval", () => {
    const evidence = parseReleaseEvidence({
      schemaVersion: "1",
      storyId: "ATL-STORY-045",
      generatedAt: new Date().toISOString(),
      verdict: "NOT_READY",
      productionApproved: false,
      gates: [],
      manualGatesRequired: ["cto_approval"],
      blockers: ["unit_tests: failed"],
      warnings: [],
    });

    expect(evidence.productionApproved).toBe(false);
    assertNeverAutoApprovesProduction(evidence);
  });

  it("rejects invalid verdict values", () => {
    const parsed = safeParseReleaseEvidence({
      schemaVersion: "1",
      storyId: "ATL-STORY-045",
      generatedAt: new Date().toISOString(),
      verdict: "RELEASE_APPROVED",
      productionApproved: false,
      gates: [],
      manualGatesRequired: [],
      blockers: [],
      warnings: [],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("release evidence evaluator", () => {
  it("never auto-approves production", () => {
    const evidence = evaluateReleaseEvidence({
      automatedGates: [
        {
          id: "unit_tests",
          name: "Unit tests",
          kind: "automated",
          severity: "P0",
          status: "passed",
        },
      ],
      stagingHealthPassed: true,
    });

    expect(evidence.productionApproved).toBe(false);
    expect(evidence.verdict).not.toBe("RELEASE_APPROVED");
    assertNeverAutoApprovesProduction(evidence);
  });

  it("returns NOT_READY when P0 automated gates fail", () => {
    const evidence = evaluateReleaseEvidence({
      automatedGates: [
        {
          id: "lint",
          name: "Lint",
          kind: "automated",
          severity: "P0",
          status: "failed",
          message: "lint errors",
        },
      ],
    });

    expect(evidence.verdict).toBe("NOT_READY");
    expect(evidence.blockers.length).toBeGreaterThan(0);
  });

  it("separates manual gates from automated gates", () => {
    const evidence = evaluateReleaseEvidence({
      automatedGates: [
        {
          id: "unit_tests",
          name: "Unit tests",
          kind: "automated",
          severity: "P0",
          status: "passed",
        },
      ],
    });

    const manual = evidence.gates.filter((gate) => gate.kind === "manual");
    const automated = evidence.gates.filter((gate) => gate.kind === "automated");

    expect(manual.length).toBeGreaterThan(0);
    expect(automated.length).toBe(1);
    expect(manual.every((gate) => gate.status === "manual_required")).toBe(true);
  });

  it("returns READY_FOR_STAGING when automated P0 passes", () => {
    const evidence = evaluateReleaseEvidence({
      automatedGates: [
        {
          id: "unit_tests",
          name: "Unit tests",
          kind: "automated",
          severity: "P0",
          status: "passed",
        },
      ],
    });

    expect(evidence.verdict).toBe("READY_FOR_STAGING");
  });

  it("returns READY_FOR_PRODUCTION_REVIEW only with staging health", () => {
    const evidence = evaluateReleaseEvidence({
      automatedGates: [
        {
          id: "unit_tests",
          name: "Unit tests",
          kind: "automated",
          severity: "P0",
          status: "passed",
        },
      ],
      stagingHealthPassed: true,
    });

    expect(evidence.verdict).toBe("READY_FOR_PRODUCTION_REVIEW");
    expect(evidence.manualGatesRequired).toContain("cto_approval");
  });
});
