import { describe, expect, it } from "vitest";
import { enrollmentCreateBodySchema } from "../../../apps/web/src/server/enrollments/schemas";

const courseId = "018f0000-0000-7000-8000-000000000001";

describe("enrollment create body schema", () => {
  it("accepts courseId only", () => {
    expect(enrollmentCreateBodySchema.parse({ courseId })).toEqual({ courseId });
  });

  it("rejects tenant_id and tenantId", () => {
    expect(() =>
      enrollmentCreateBodySchema.parse({
        courseId,
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();

    expect(() =>
      enrollmentCreateBodySchema.parse({
        courseId,
        tenantId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects identity fields", () => {
    for (const field of ["userId", "memberId", "membershipId"] as const) {
      expect(() =>
        enrollmentCreateBodySchema.parse({
          courseId,
          [field]: "018f0000-0000-7000-8000-000000000099",
        }),
      ).toThrow();
    }
  });

  it("rejects unsafe enrollment control fields", () => {
    for (const field of ["status", "source", "role"] as const) {
      expect(() =>
        enrollmentCreateBodySchema.parse({
          courseId,
          [field]: "active",
        }),
      ).toThrow();
    }
  });

  it("rejects unknown unsafe fields", () => {
    expect(() =>
      enrollmentCreateBodySchema.parse({
        courseId,
        enrolledByAdmin: true,
      }),
    ).toThrow();
  });
});
