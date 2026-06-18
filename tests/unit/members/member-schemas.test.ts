import { describe, expect, it } from "vitest";
import { inviteMemberBodySchema, memberListQuerySchema } from "@atlas/membership";

describe("member schemas", () => {
  it("rejects tenant_id on invite mutation body", () => {
    expect(() =>
      inviteMemberBodySchema.parse({
        email: "member@example.com",
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("rejects unknown list filters", () => {
    expect(() =>
      memberListQuerySchema.parse({
        status: "ACTIVE",
        sort: "created_at",
      }),
    ).toThrow();
  });

  it("accepts indexed list filters", () => {
    const parsed = memberListQuerySchema.parse({
      limit: 25,
      status: "ACTIVE",
    });

    expect(parsed.status).toBe("ACTIVE");
  });
});
