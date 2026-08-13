import { describe, expect, it } from "vitest";
import {
  computeProctoringRiskScore,
  PROCTORING_RISK_GOLDEN_FIXTURES,
} from "../../../backend/apps/api/src/server/proctoring/proctoring-risk";

describe("computeProctoringRiskScore golden fixtures", () => {
  it("maps clean fixture to score 0 / clean", () => {
    const result = computeProctoringRiskScore(PROCTORING_RISK_GOLDEN_FIXTURES.clean);
    expect(result).toEqual({ score: 0, band: "clean", raw: 0 });
  });

  it("maps mild fixture to mild band", () => {
    const result = computeProctoringRiskScore(PROCTORING_RISK_GOLDEN_FIXTURES.mild);
    expect(result.score).toBe(3);
    expect(result.band).toBe("mild");
    expect(result.raw).toBe(3);
  });

  it("maps elevated fixture to elevated band", () => {
    const result = computeProctoringRiskScore(PROCTORING_RISK_GOLDEN_FIXTURES.elevated);
    expect(result.score).toBe(14);
    expect(result.band).toBe("elevated");
  });

  it("maps egregious fixture to egregious band", () => {
    const result = computeProctoringRiskScore(PROCTORING_RISK_GOLDEN_FIXTURES.egregious);
    expect(result.score).toBe(31);
    expect(result.band).toBe("egregious");
  });

  it("is deterministic for the same multiset", () => {
    const a = computeProctoringRiskScore(["copy", "face_absent", "copy"]);
    const b = computeProctoringRiskScore(["copy", "face_absent", "copy"]);
    expect(a).toEqual(b);
    expect(a.score).toBe(8);
    expect(a.band).toBe("mild");
  });

  it("caps score at 100", () => {
    const events = Array.from({ length: 20 }, () => "identity_verification_failed");
    const result = computeProctoringRiskScore(events);
    expect(result.score).toBe(100);
    expect(result.band).toBe("egregious");
  });
});
