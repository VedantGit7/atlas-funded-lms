import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLATFORM_ROLE_PERMISSIONS } from "@atlas/access";

describe("platform authorization matrix", () => {
  it("grants super admin all platform capabilities", () => {
    expect(PLATFORM_ROLE_PERMISSIONS.super_admin).toEqual(
      expect.arrayContaining([
        "platform.tenant.read",
        "platform.tenant.manage",
        "platform.entitlement.manage",
        "platform.feature_flag.manage",
        "platform.catalog.manage",
        "platform.audit.read",
        "platform.support.access",
      ]),
    );
  });

  it("denies operations catalog manage", () => {
    expect(PLATFORM_ROLE_PERMISSIONS.operations).not.toContain("platform.catalog.manage");
  });

  it("limits support to read-biased permissions", () => {
    expect(PLATFORM_ROLE_PERMISSIONS.support).toEqual(
      expect.arrayContaining([
        "platform.tenant.read",
        "platform.audit.read",
        "platform.support.access",
      ]),
    );
    expect(PLATFORM_ROLE_PERMISSIONS.support).not.toContain("platform.tenant.manage");
    expect(PLATFORM_ROLE_PERMISSIONS.support).not.toContain("platform.entitlement.manage");
    expect(PLATFORM_ROLE_PERMISSIONS.support).not.toContain("platform.feature_flag.manage");
    expect(PLATFORM_ROLE_PERMISSIONS.support).not.toContain("platform.catalog.manage");
  });
});

describe("platform shell host restriction", () => {
  it("blocks platform layout on tenant host messaging", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../../frontend/apps/web/src/lib/server/platform-host-gate.ts"),
      "utf8",
    );
    expect(source).toContain("PLATFORM_HOST");
  });
});
