import { describe, expect, it } from "vitest";
import { assignRoleBodySchema } from "@atlas/domain-access/schemas/access-admin";

describe("member role assignment schemas", () => {
  it("rejects tenant_id on assign body", () => {
    expect(() =>
      assignRoleBodySchema.parse({
        roleId: "018f0000-0000-7000-8000-000000000020",
        tenantId: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });
});
