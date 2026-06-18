import { describe, expect, it } from "vitest";
import { inviteMemberBodySchema, memberListQuerySchema } from "@atlas/membership";
import { createRoleBodySchema } from "@atlas/domain-access/schemas/access-admin";

describe("admin member role management tenant isolation inputs", () => {
  it("rejects client tenant_id on member invite body", () => {
    expect(() =>
      inviteMemberBodySchema.parse({
        email: "member@example.com",
        tenantId: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects client tenant_id on role create body", () => {
    expect(() =>
      createRoleBodySchema.parse({
        key: "support",
        name: "Support",
        permissions: ["profile.read"],
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects unknown tenant_id query filters on member list", () => {
    expect(() =>
      memberListQuerySchema.parse({
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
