import { describe, expect, it } from "vitest";
import { createPermissionOverrideBodySchema } from "@atlas/domain-access/schemas/access-admin";

describe("permission override schemas", () => {
  it("rejects tenant_id on create body", () => {
    expect(() =>
      createPermissionOverrideBodySchema.parse({
        membershipId: "018f0000-0000-7000-8000-000000000010",
        permissionKey: "profile.read",
        effect: "ALLOW",
        tenant_id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });
});
