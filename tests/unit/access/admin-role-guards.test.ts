import { describe, expect, it } from "vitest";
import {
  assertCannotAssignOwnerRole,
  assertRoleAssignRankGuard,
  assertRoleEditGuard,
  assertRoleRevokeRankGuard,
  assertSystemRoleDeleteGuard,
  assertTargetIsNotOwner,
} from "@atlas/access";

describe("admin role guards", () => {
  it("denies suspend/remove owner target", () => {
    expect(() => assertTargetIsNotOwner(true)).toThrow(/owner membership/i);
  });

  it("denies assigning owner role", () => {
    expect(() => assertCannotAssignOwnerRole("owner")).toThrow(/owner role cannot be assigned/i);
  });

  it("denies admin assigning admin role", () => {
    expect(() =>
      assertRoleAssignRankGuard({ actorRoleKeys: ["admin"], targetRoleKey: "admin" }),
    ).toThrow(/Only the owner may assign the admin role/i);
  });

  it("allows owner assigning admin role", () => {
    expect(() =>
      assertRoleAssignRankGuard({ actorRoleKeys: ["owner"], targetRoleKey: "admin" }),
    ).not.toThrow();
  });

  it("denies admin revoking owner role", () => {
    expect(() =>
      assertRoleRevokeRankGuard({ actorRoleKeys: ["admin"], targetRoleKey: "owner" }),
    ).toThrow(/owner role cannot be revoked/i);
  });

  it("denies admin editing owner role", () => {
    expect(() =>
      assertRoleEditGuard({
        actorRoleKeys: ["admin"],
        roleKey: "owner",
        isSystem: true,
      }),
    ).toThrow(/owner role cannot be edited/i);
  });

  it("denies deleting system roles", () => {
    expect(() => assertSystemRoleDeleteGuard(true)).toThrow(/System roles cannot be deleted/i);
  });
});
