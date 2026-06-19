import { describe, expect, it } from "vitest";
import {
  assertCoursePublishable,
  canApproveCourseReview,
  canSubmitCourseForReview,
} from "../../../apps/web/src/server/courses/course-state-guards";

describe("workflow course state helpers", () => {
  it("allows DRAFT to submit for review", () => {
    expect(canSubmitCourseForReview("DRAFT")).toBe(true);
    expect(() => assertCoursePublishable("DRAFT")).not.toThrow();
  });

  it("allows REVIEW to approve", () => {
    expect(canApproveCourseReview("REVIEW")).toBe(true);
  });

  it("forbids PUBLISHED submit for review", () => {
    expect(canSubmitCourseForReview("PUBLISHED")).toBe(false);
    expect(() => assertCoursePublishable("PUBLISHED")).toThrow();
  });

  it("forbids ARCHIVED submit for review", () => {
    expect(canSubmitCourseForReview("ARCHIVED")).toBe(false);
    expect(() => assertCoursePublishable("ARCHIVED")).toThrow();
  });
});
