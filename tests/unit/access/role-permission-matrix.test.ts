import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  TENANT_SYSTEM_ROLES,
  validateAccessSeedData,
} from "@atlas/access";

describe("role permission seed matrix", () => {
  it("passes seed validation", () => {
    expect(() => validateAccessSeedData()).not.toThrow();
  });

  it("uses only known tenant role keys", () => {
    const allowedRoles = new Set(TENANT_SYSTEM_ROLES.map((role) => role.key));

    for (const roleKey of Object.keys(ROLE_PERMISSIONS)) {
      expect(allowedRoles.has(roleKey as never)).toBe(true);
    }
  });

  it("does not grant platform permissions to tenant roles", () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      expect(permissions.some((permission) => permission.startsWith("platform."))).toBe(false);
    }
  });

  it("does not reference missing permissions", () => {
    const permissionKeys = new Set(PERMISSIONS.map((permission) => permission.key));

    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(permissionKeys.has(permission)).toBe(true);
      }
    }
  });
});
