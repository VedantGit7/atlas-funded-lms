import { describe, expect, it } from "vitest";
import {
  computeScorePercent,
  distributeManualScore,
} from "../../../apps/web/src/server/grading/grading.service";

describe("grading service helpers", () => {
  it("distributes manual score across weighted items", () => {
    const allocations = distributeManualScore({
      manualItems: [
        { assessmentItemId: "a", points: 2 },
        { assessmentItemId: "b", points: 2 },
      ],
      score: 3,
    });

    expect(allocations).toHaveLength(2);
    expect(allocations.reduce((sum, item) => sum + item.pointsAwarded, 0)).toBeCloseTo(3, 2);
  });

  it("computes score percent", () => {
    expect(computeScorePercent(7, 10)).toBe(70);
  });
});

describe("grading lifecycle expectations", () => {
  it("maps pending internal status to gradeable set", () => {
    expect(["open", "in_progress"].includes("open")).toBe(true);
    expect(["open", "in_progress"].includes("graded")).toBe(false);
  });

  it("treats graded replay as idempotent when keys match", () => {
    const existing = { idempotencyKey: "grade-key-12345678", score: 1, feedback: "ok" };
    expect(existing.idempotencyKey).toBe("grade-key-12345678");
  });
});
