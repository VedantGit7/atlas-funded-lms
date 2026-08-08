import { describe, expect, it } from "vitest";
import {
  AssessmentConfigSchema,
  AssessmentItemInputSchema,
  CreateAssessmentBodySchema,
  SaveAnswerBodySchema,
  SubmitAttemptBodySchema,
  UpdateAssessmentBodySchema,
} from "../../../frontend/apps/web/src/features/assessments/schemas";

describe("assessment schemas", () => {
  it("accepts valid quiz config", () => {
    const parsed = CreateAssessmentBodySchema.parse({
      title: "Quiz 1",
      assessmentType: "quiz",
      config: {
        attemptsAllowed: 2,
        timeLimitSeconds: 900,
        passMarkPercent: 70,
      },
    });

    expect(parsed.assessmentType).toBe("quiz");
    expect(parsed.config.attemptsAllowed).toBe(2);
  });

  it("accepts valid diagnostic type", () => {
    const parsed = CreateAssessmentBodySchema.parse({
      title: "Diagnostic",
      assessmentType: "diagnostic",
      config: {},
    });

    expect(parsed.assessmentType).toBe("diagnostic");
  });

  it("rejects invalid time limit", () => {
    expect(() =>
      AssessmentConfigSchema.parse({
        attemptsAllowed: 1,
        timeLimitSeconds: 30,
        passMarkPercent: 70,
      }),
    ).toThrow();
  });

  it("rejects invalid pass mark", () => {
    expect(() =>
      AssessmentConfigSchema.parse({
        attemptsAllowed: 1,
        passMarkPercent: 120,
      }),
    ).toThrow();
  });

  it("accepts update config with null time limit to clear it", () => {
    const parsed = UpdateAssessmentBodySchema.parse({
      title: "Quiz 1",
      config: {
        attemptsAllowed: 1,
        timeLimitSeconds: null,
        passMarkPercent: 70,
      },
      items: [
        {
          itemId: "018f0000-0000-7000-8000-000000000001",
          position: 1,
          points: 1,
          required: true,
        },
      ],
    });

    expect(parsed.config?.timeLimitSeconds).toBeNull();
  });

  it("validates item positions", () => {
    const items = AssessmentItemInputSchema.array().parse([
      { itemId: "018f0000-0000-7000-8000-000000000001", position: 1, points: 1, required: true },
      { itemId: "018f0000-0000-7000-8000-000000000002", position: 2, points: 2, required: false },
    ]);

    expect(items).toHaveLength(2);
  });
});

describe("attempt schemas", () => {
  it("accepts valid answer body", () => {
    const parsed = SaveAnswerBodySchema.parse({
      itemId: "018f0000-0000-7000-8000-000000000001",
      answerJson: { selectedOptionId: "018f0000-0000-7000-8000-000000000099" },
    });

    expect(parsed.answerJson.selectedOptionId).toBeTruthy();
  });

  it("rejects invalid item id", () => {
    expect(() =>
      SaveAnswerBodySchema.parse({
        itemId: "not-a-uuid",
        answerJson: {},
      }),
    ).toThrow();
  });

  it("accepts submit body", () => {
    expect(SubmitAttemptBodySchema.parse({})).toEqual({});
  });
});
