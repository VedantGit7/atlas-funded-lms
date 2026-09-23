import { describe, expect, it, vi } from "vitest";
import * as outline from "../../../frontend/apps/web/src/features/courses/course-outline";

vi.mock("../../../frontend/apps/web/src/lib/client-api", () => ({
  clientApi: { get: vi.fn() },
}));

describe("course outline lesson requests", () => {
  it("loads an enrolled chapter without requiring a tag filter", () => {
    expect(outline).toHaveProperty("courseModuleLessonsPath", expect.any(Function));
    expect(outline.courseModuleLessonsPath("module-1")).toBe("/api/v1/modules/module-1/lessons");
  });

  it("encodes an optional tag as one query value", () => {
    expect(outline).toHaveProperty("courseModuleLessonsPath", expect.any(Function));
    const url = new URL(
      outline.courseModuleLessonsPath("module-1", "tag & details"),
      "https://example.test",
    );
    expect(url.pathname).toBe("/api/v1/modules/module-1/lessons");
    expect([...url.searchParams.entries()]).toEqual([["tagId", "tag & details"]]);
  });
});
