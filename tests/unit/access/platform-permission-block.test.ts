import { describe, expect, it } from "vitest";
import {
  assertTenantScopedPermissionKey,
  assertTenantScopedPermissionKeys,
  isPlatformPermission,
  isWildcardPermission,
} from "@atlas/access";

describe("platform permission block", () => {
  it("detects platform permissions", () => {
    expect(isPlatformPermission("platform.tenant.read")).toBe(true);
    expect(isPlatformPermission("membership.read")).toBe(false);
  });

  it("detects wildcard permissions", () => {
    expect(isWildcardPermission("course.*")).toBe(true);
    expect(isWildcardPermission("membership.read")).toBe(false);
  });

  it("rejects platform permissions for tenant payloads", () => {
    expect(() => assertTenantScopedPermissionKey("platform.tenant.read")).toThrow(
      /PLATFORM_PERMISSION_FORBIDDEN/,
    );
  });

  it("rejects wildcard permissions for tenant payloads", () => {
    expect(() => assertTenantScopedPermissionKeys(["membership.read", "role.*"])).toThrow(
      /WILDCARD_PERMISSION_FORBIDDEN/,
    );
  });
});
