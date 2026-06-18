import { describe, expect, it } from "vitest";
import {
  createCourseBodySchema,
  createModuleBodySchema,
  publishCourseBodySchema,
  studioCourseListQuerySchema,
  updateCourseBodySchema,
  updateModuleBodySchema,
} from "../../../apps/web/src/server/courses/course-authoring-schemas";
import { courseListQuerySchema } from "../../../apps/web/src/server/courses/schemas";
import {
  assertCourseEditable,
  assertCoursePublishable,
  validateModulePositions,
} from "../../../apps/web/src/server/courses/course-state-guards";

describe("course authoring schemas", () => {
  it("accepts valid course create body", () => {
    const parsed = createCourseBodySchema.parse({
      title: "Risk Foundations",
      description: "Intro course",
    });
    expect(parsed.title).toBe("Risk Foundations");
  });

  it("rejects tenant_id on course create", () => {
    expect(() =>
      createCourseBodySchema.parse({
        title: "Course",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects unsafe identity fields on course update", () => {
    expect(() =>
      updateCourseBodySchema.parse({
        title: "Updated",
        createdBy: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects client-controlled status on course update", () => {
    expect(() =>
      updateCourseBodySchema.parse({
        status: "PUBLISHED",
      }),
    ).toThrow();
  });

  it("accepts module create and update bodies", () => {
    expect(createModuleBodySchema.parse({ title: "Module 1" }).title).toBe("Module 1");
    expect(updateModuleBodySchema.parse({ position: 2 }).position).toBe(2);
  });

  it("rejects tenantId on module create", () => {
    expect(() =>
      createModuleBodySchema.parse({
        title: "Module",
        tenantId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("accepts publish body reason only", () => {
    expect(publishCourseBodySchema.parse({ reason: "Ready for review" }).reason).toBe(
      "Ready for review",
    );
  });

  it("requires view=studio for status filter", () => {
    expect(() => courseListQuerySchema.parse({ status: "DRAFT" })).toThrow();
    expect(studioCourseListQuerySchema.parse({ view: "studio", status: "DRAFT" }).status).toBe(
      "DRAFT",
    );
  });
});

describe("course state guards", () => {
  it("allows editing only draft courses", () => {
    expect(() => assertCourseEditable("DRAFT")).not.toThrow();
    expect(() => assertCourseEditable("REVIEW")).toThrow();
    expect(() => assertCourseEditable("PUBLISHED")).toThrow();
  });

  it("requires draft for publish submission", () => {
    expect(() => assertCoursePublishable("DRAFT")).not.toThrow();
    expect(() => assertCoursePublishable("REVIEW")).toThrow();
  });

  it("validates sequential unique module positions", () => {
    expect(() => validateModulePositions([1, 2, 3])).not.toThrow();
    expect(() => validateModulePositions([1, 1])).toThrow();
    expect(() => validateModulePositions([1, 3])).toThrow();
  });
});
