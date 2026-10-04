import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PLATFORM_ROLE_PERMISSIONS, type PlatformRoleKey } from "@atlas/access";
import { loadPlatformPermissions } from "@atlas/auth/platform-auth";

/**
 * The permissions a platform request is authorised with must be exactly the
 * role catalogue's. A second, hand-copied map in @atlas/auth once drifted
 * from it and silently denied the cost console (platform.cost.*) to every
 * operator, while the tests here only checked the catalogue.
 */
function grantFor(roleKey: PlatformRoleKey) {
  return {
    $queryRaw: vi.fn(async () => [
      {
        id: "grant-1",
        auth_principal_id: "principal-1",
        role_key: roleKey,
        granted_at: new Date(),
        granted_by_principal_id: null,
        grant_reason: "test",
      },
    ]),
  };
}

describe("platform authorisation uses the role catalogue", () => {
  it.each(["super_admin", "operations", "support"] as const)(
    "grants a %s exactly the catalogue's permissions",
    async (role) => {
      await expect(loadPlatformPermissions(grantFor(role), "principal-1")).resolves.toEqual([
        ...PLATFORM_ROLE_PERMISSIONS[role],
      ]);
    },
  );

  it("lets super_admin and operations reach the cost console, and support not", async () => {
    for (const role of ["super_admin", "operations"] as const) {
      const permissions = await loadPlatformPermissions(grantFor(role), "principal-1");
      expect(permissions).toEqual(
        expect.arrayContaining(["platform.cost.read", "platform.cost.manage"]),
      );
    }
    const support = await loadPlatformPermissions(grantFor("support"), "principal-1");
    expect(support).not.toContain("platform.cost.read");
  });

  it("keeps a single definition of the role map", () => {
    const auth = resolve(import.meta.dirname, "../../../backend/packages/auth/src");
    for (const file of ["platform-auth.ts", "platform-operators.repository.ts"]) {
      const source = readFileSync(resolve(auth, file), "utf8");
      expect(source).not.toMatch(/PLATFORM_ROLE_PERMISSIONS\s*[:=]/);
    }
    expect(() => readFileSync(resolve(auth, "platform-role-resolution.ts"))).toThrow();
  });
});
