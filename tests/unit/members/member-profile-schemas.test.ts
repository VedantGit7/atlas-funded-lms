import { describe, expect, it } from "vitest";
import { updateMemberProfileBodySchema } from "@atlas/membership";

describe("member profile schemas", () => {
  it("rejects tenantId on profile update body", () => {
    expect(() =>
      updateMemberProfileBodySchema.parse({
        displayName: "Updated Name",
        tenantId: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("accepts nullable profile fields", () => {
    const parsed = updateMemberProfileBodySchema.parse({
      displayName: null,
      bio: null,
    });

    expect(parsed.displayName).toBeNull();
  });
});
