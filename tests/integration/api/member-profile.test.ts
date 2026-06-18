import { describe, expect, it } from "vitest";
import { updateMemberProfileBodySchema } from "@atlas/membership";

describe("member profile API schemas", () => {
  it("rejects client tenant_id on profile update", () => {
    expect(() =>
      updateMemberProfileBodySchema.parse({
        displayName: "Name",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });
});
