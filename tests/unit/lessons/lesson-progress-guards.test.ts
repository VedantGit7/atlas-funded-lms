import { describe, expect, it } from "vitest";
import {
  boundPositionSeconds,
  computeProgressPct,
  computePositionSeconds,
  isCompletionIdempotent,
  isFirstCompletion,
  resolveProgressStatus,
  shouldAdvanceProgressPct,
} from "../../../apps/web/src/server/lessons/lesson-progress-guards";

describe("lesson progress guards", () => {
  it("computes progress pct from position and duration", () => {
    expect(computeProgressPct(120, 600)).toBe(20);
  });

  it("bounds position to duration", () => {
    expect(boundPositionSeconds(900, 600)).toBe(600);
  });

  it("does not regress progress pct", () => {
    expect(shouldAdvanceProgressPct(40, 20, "in_progress")).toBe(40);
  });

  it("keeps completed progress at 100", () => {
    expect(shouldAdvanceProgressPct(40, 20, "completed")).toBe(100);
  });

  it("resolves completed status idempotently", () => {
    expect(
      resolveProgressStatus({
        existingStatus: "completed",
        completed: false,
        progressPct: 50,
      }),
    ).toBe("completed");
  });

  it("detects first completion", () => {
    expect(isFirstCompletion({ existingStatus: "in_progress", completed: true })).toBe(true);
    expect(isFirstCompletion({ existingStatus: "completed", completed: true })).toBe(false);
  });

  it("detects completion idempotency", () => {
    expect(isCompletionIdempotent("completed")).toBe(true);
    expect(isCompletionIdempotent("in_progress")).toBe(false);
  });

  it("computes position seconds from pct", () => {
    expect(computePositionSeconds(50, 600)).toBe(300);
  });
});
