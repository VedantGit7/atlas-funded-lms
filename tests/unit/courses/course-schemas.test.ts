import { describe, expect, it } from "vitest";
import {
  courseIdParamsSchema,
  courseListQuerySchema,
} from "../../../apps/web/src/server/courses/schemas";

describe("course list query schema", () => {
  it("accepts allow-listed filters", () => {
    const parsed = courseListQuerySchema.parse({
      limit: 10,
      q: "risk",
      stage: "foundation",
      sort: "title_asc",
    });

    expect(parsed.limit).toBe(10);
    expect(parsed.q).toBe("risk");
    expect(parsed.sort).toBe("title_asc");
  });

  it("validates cursor and limit bounds", () => {
    expect(() => courseListQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => courseListQuerySchema.parse({ limit: 101 })).toThrow();
    expect(courseListQuerySchema.parse({ cursor: "abc" }).cursor).toBe("abc");
  });

  it("rejects unsupported query fields", () => {
    expect(() =>
      courseListQuerySchema.parse({
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();

    expect(() =>
      courseListQuerySchema.parse({
        instructorId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});

describe("course id params schema", () => {
  it("requires a uuid course id", () => {
    expect(() => courseIdParamsSchema.parse({ id: "not-a-uuid" })).toThrow();
    expect(courseIdParamsSchema.parse({ id: "018f0000-0000-7000-8000-000000000001" }).id).toBe(
      "018f0000-0000-7000-8000-000000000001",
    );
  });
});
