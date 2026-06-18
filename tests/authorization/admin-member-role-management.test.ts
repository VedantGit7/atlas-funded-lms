import { describe, expect, it } from "vitest";
import {
  assertCannotAssignOwnerRole,
  assertNoGrantUp,
  assertRoleAssignRankGuard,
  assertTargetIsNotOwner,
} from "@atlas/access";

describe("admin member role management authorization guards", () => {
  it("learner-level actor permissions cannot satisfy role.assign grant-up", () => {
    expect(() =>
      assertNoGrantUp({
        actorPermissionKeys: new Set(["profile.read"]),
        requestedPermissionKeys: ["role.assign"],
      }),
    ).toThrow(/cannot grant permissions you do not hold/i);
  });

  it("admin cannot assign owner role", () => {
    expect(() => assertCannotAssignOwnerRole("owner")).toThrow();
  });

  it("admin cannot assign admin role", () => {
    expect(() =>
      assertRoleAssignRankGuard({ actorRoleKeys: ["admin"], targetRoleKey: "admin" }),
    ).toThrow();
  });

  it("admin cannot suspend/remove owner membership target", () => {
    expect(() => assertTargetIsNotOwner(true)).toThrow();
  });

  it("admin cannot grant platform permissions via no-grant-up path", () => {
    expect(() =>
      assertNoGrantUp({
        actorPermissionKeys: new Set(["membership.read", "role.create"]),
        requestedPermissionKeys: ["platform.tenant.read"],
      }),
    ).toThrow();
  });
});
