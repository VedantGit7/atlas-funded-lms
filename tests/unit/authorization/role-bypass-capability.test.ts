import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TENANT_SYSTEM_ROLES } from "@atlas/access";

/**
 * Audit finding H11 — the hardcoded admin bypass.
 *
 * `can()` contained:
 *
 * ```ts
 * function isAdminBypassRole(roleKeys: string[]): boolean {
 *   return roleKeys.includes("owner") || roleKeys.includes("admin");
 * }
 * ```
 *
 * On a match it skipped every ownership and relationship predicate. Three
 * consequences: the bypass was invisible in the data, it could not be revoked
 * without a deploy, and **any custom role keyed "admin" inherited it by name**
 * — creating one was a privilege escalation that no permission grant recorded.
 *
 * It is a column on the role now (`bypasses_resource_predicates`), read through
 * the grant, with a CHECK constraint reserving the system keys.
 */

/**
 * Strip comments before asserting.
 *
 * Without this the test matches its own explanation of the old code — the same
 * mistake the authorization suite made when a comment claiming denial handling
 * was the only reason a screen passed. An assertion about code must read code.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("role bypass capability (H11)", () => {
  it("no longer decides the bypass from role keys", () => {
    const canSource = stripComments(
      readFileSync("backend/packages/authorization/src/can.ts", "utf8"),
    );

    expect(canSource).not.toContain("isAdminBypassRole");
    expect(canSource).not.toMatch(/roleKeys\.includes\(\s*["']admin["']\s*\)/);
    expect(canSource).not.toMatch(/roleKeys\.includes\(\s*["']owner["']\s*\)/);
    expect(canSource).toContain("grant?.bypassesResourcePredicates");
  });

  it("carries the capability on the grant, read from the role record", () => {
    const repo = readFileSync(
      "backend/packages/authorization/src/authorization.repository.ts",
      "utf8",
    );

    expect(repo).toContain("bypasses_resource_predicates");
    expect(repo).toContain("bypassesResourcePredicates");
  });

  it("grants the bypass to exactly the two tenant-authority roles", () => {
    const bypassing = TENANT_SYSTEM_ROLES.filter((role) => role.bypassesResourcePredicates).map(
      (role) => role.key,
    );

    // Widening this set grants tenant-wide authority, so it should be a
    // deliberate edit that fails here first.
    expect(bypassing.sort()).toEqual(["admin", "owner"]);
  });

  it("keeps instructor, moderator and learner subject to resource predicates", () => {
    for (const key of ["instructor", "moderator", "learner"] as const) {
      const role = TENANT_SYSTEM_ROLES.find((entry) => entry.key === key);
      expect(role?.bypassesResourcePredicates, key).toBe(false);
    }
  });

  it("reserves the system role keys at the schema level", () => {
    const migration = readFileSync(
      "backend/prisma/migrations/20260819120000_100_role_bypass_capability/migration.sql",
      "utf8",
    );

    expect(migration).toContain("roles_reserved_keys_are_system");
    for (const role of TENANT_SYSTEM_ROLES) {
      expect(migration, `${role.key} must be reserved`).toContain(`'${role.key}'`);
    }
  });
});
