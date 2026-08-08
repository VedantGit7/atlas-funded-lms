import { describe, expect, it } from "vitest";
import {
  gradeTaskBodySchema,
  gradingListQuerySchema,
} from "../../../backend/apps/api/src/server/grading/grading-schemas";

describe("GradeTaskBodySchema", () => {
  it("accepts valid score and feedback", () => {
    const parsed = gradeTaskBodySchema.parse({
      score: 4,
      feedback: "Strong answer with clear reasoning.",
    });

    expect(parsed.score).toBe(4);
    expect(parsed.feedback).toBe("Strong answer with clear reasoning.");
  });

  it("rejects empty feedback", () => {
    expect(() => gradeTaskBodySchema.parse({ score: 1, feedback: "   " })).toThrow();
  });

  it("rejects negative score", () => {
    expect(() => gradeTaskBodySchema.parse({ score: -1, feedback: "Needs work" })).toThrow();
  });

  it("rejects invalid idempotencyKey", () => {
    expect(() =>
      gradeTaskBodySchema.parse({
        score: 1,
        feedback: "ok",
        idempotencyKey: "short",
      }),
    ).toThrow();
  });

  it("accepts rubricJson", () => {
    const parsed = gradeTaskBodySchema.parse({
      score: 2,
      feedback: "Partial credit",
      rubricJson: { clarity: 2 },
    });

    expect(parsed.rubricJson).toEqual({ clarity: 2 });
  });

  it("accepts graderNotesJson", () => {
    const parsed = gradeTaskBodySchema.parse({
      score: 2,
      feedback: "Partial credit",
      graderNotesJson: { internal: "borderline" },
    });

    expect(parsed.graderNotesJson).toEqual({ internal: "borderline" });
  });
});

describe("GradingListQuerySchema", () => {
  it("defaults assignedTo to me", () => {
    expect(gradingListQuerySchema.parse({}).assignedTo).toBe("me");
  });

  it("caps limit at 100", () => {
    expect(() => gradingListQuerySchema.parse({ limit: 101 })).toThrow();
  });
});
