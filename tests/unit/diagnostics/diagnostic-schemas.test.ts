import { describe, expect, it } from "vitest";
import {
  AuthenticatedDiagnosticStartBodySchema,
  PublicDiagnosticCompleteOperationSchema,
  PublicDiagnosticStartOperationSchema,
  assertPublicScorecardSafe,
  diagnosticScorecardSchema,
} from "../../../backend/apps/api/src/server/diagnostics/diagnostic.schemas";

describe("diagnostic schemas", () => {
  it("rejects client identity fields", () => {
    expect(() =>
      PublicDiagnosticStartOperationSchema.parse({
        operation: "start",
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();

    expect(() =>
      PublicDiagnosticCompleteOperationSchema.parse({
        operation: "complete",
        anonymousId: "018f0000-0000-7000-8000-000000000002",
        answers: [{ itemId: "018f0000-0000-7000-8000-000000000003", answerJson: {} }],
        membershipId: "018f0000-0000-7000-8000-000000000004",
      }),
    ).toThrow();

    expect(() =>
      AuthenticatedDiagnosticStartBodySchema.parse({
        attemptId: "018f0000-0000-7000-8000-000000000005",
      }),
    ).toThrow();
  });

  it("rejects duplicate answer item IDs", () => {
    const itemId = "018f0000-0000-7000-8000-000000000003";

    expect(() =>
      PublicDiagnosticCompleteOperationSchema.parse({
        operation: "complete",
        anonymousId: "018f0000-0000-7000-8000-000000000002",
        answers: [
          { itemId, answerJson: { selectedOptionId: "a" } },
          { itemId, answerJson: { selectedOptionId: "b" } },
        ],
      }),
    ).toThrow(/Duplicate answer item IDs/);
  });

  it("public scorecard projection excludes answer keys and unsafe copy", () => {
    const safeScorecard = {
      partial: true,
      overallScore: 55,
      overallBandKey: "developing",
      overallBandLabel: "Developing",
      interpretation: "Educational snapshot only.",
      dimensions: [
        {
          dimensionId: "018f0000-0000-7000-8000-000000000010",
          dimensionKey: "execution_skill",
          dimensionName: "Execution Skill",
          score: 55,
          bandKey: "developing",
          bandLabel: "Developing",
        },
      ],
      nextAction: {
        key: "focus_execution_skill",
        title: "Focus on Execution Skill",
        description: "Continue learning in this area.",
      },
    };

    expect(() => assertPublicScorecardSafe(safeScorecard)).not.toThrow();
    expect(() =>
      diagnosticScorecardSchema.parse({
        ...safeScorecard,
        interpretation: "This is guaranteed funding advice.",
      }),
    ).toThrow();
  });
});
