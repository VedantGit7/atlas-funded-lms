import { describe, expect, it } from "vitest";
import { assertNoGrantUp } from "@atlas/access";

describe("no-grant-up", () => {
  it("denies granting permissions the actor does not hold", () => {
    const actorKeys = new Set(["membership.read", "profile.read"]);

    expect(() =>
      assertNoGrantUp({
        actorPermissionKeys: actorKeys,
        requestedPermissionKeys: ["membership.read", "role.assign"],
      }),
    ).toThrow(/cannot grant permissions you do not hold/i);
  });

  it("allows granting only held permissions", () => {
    const actorKeys = new Set(["membership.read", "role.assign"]);

    expect(() =>
      assertNoGrantUp({
        actorPermissionKeys: actorKeys,
        requestedPermissionKeys: ["membership.read"],
      }),
    ).not.toThrow();
  });
});
