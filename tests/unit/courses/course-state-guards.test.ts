import { describe, expect, it } from "vitest";
import {
  assertCourseArchivable,
  assertCourseContentEditable,
  assertCourseEditable,
  assertCoursePublishable,
  assertModuleEditable,
  validateModulePositions,
} from "../../../backend/apps/api/src/server/courses/course-state-guards";

describe("course state guards", () => {
  it("blocks editing review and published courses", () => {
    expect(() => assertCourseEditable("REVIEW")).toThrow();
    expect(() => assertCourseEditable("PUBLISHED")).toThrow();
    expect(() => assertCourseEditable("ARCHIVED")).toThrow();
  });

  it("blocks publish unless draft", () => {
    expect(() => assertCoursePublishable("PUBLISHED")).toThrow();
  });

  it("blocks archiving published courses with active enrollments", () => {
    expect(() => assertCourseArchivable("PUBLISHED", true)).toThrow();
    expect(() => assertCourseArchivable("DRAFT", false)).not.toThrow();
  });

  it("lets sections and lessons change in draft and live courses, not in review or archive", () => {
    expect(() => assertModuleEditable("DRAFT")).not.toThrow();
    expect(() => assertModuleEditable("PUBLISHED")).not.toThrow();
    expect(() => assertModuleEditable("REVIEW")).toThrow(/in review/);
    expect(() => assertCourseContentEditable("ARCHIVED")).toThrow(/archived/);
  });

  it("accepts empty module list positions", () => {
    expect(() => validateModulePositions([])).not.toThrow();
  });
});
