import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src/components/shells");

const TENANT_SHELLS = [
  "PublicSiteShell.tsx",
  "AuthShell.tsx",
  "LearnerShellClient.tsx",
  "StudioShellClient.tsx",
  "TenantAdminShellClient.tsx",
  "ModerationShellClient.tsx",
  "ReviewShellClient.tsx",
] as const;

const OPERATIONAL_SHELLS = new Set([
  "ModerationShellClient.tsx",
]);

const ADMIN_STYLE_SHELLS = new Set([
  "StudioShellClient.tsx",
  "TenantAdminShellClient.tsx",
]);

const layoutSource = readFileSync(
  resolve(webRoot, "shared/OperationalShellLayout.tsx"),
  "utf8",
);

function shellProvidesA11yLandmarks(fileName: string): boolean {
  const source = readFileSync(resolve(webRoot, fileName), "utf8");
  if (OPERATIONAL_SHELLS.has(fileName)) {
    return source.includes("OperationalShellLayout");
  }
  if (ADMIN_STYLE_SHELLS.has(fileName)) {
    const shellFile =
      fileName === "StudioShellClient.tsx"
        ? readFileSync(resolve(webRoot, "studio/StudioShell.tsx"), "utf8")
        : readFileSync(resolve(webRoot, "admin/AdminShell.tsx"), "utf8");
    return (
      source.includes("StudioShell") || source.includes("AdminShell")
    ) && (shellFile.includes("Skip to content") && (shellFile.includes('id="studio-main"') || shellFile.includes('id="admin-main"')));
  }
  return source.includes("ShellSkipLink") && source.includes('id="main-content"');
}

function shellUsesBranding(fileName: string): boolean {
  const source = readFileSync(resolve(webRoot, fileName), "utf8");
  if (ADMIN_STYLE_SHELLS.has(fileName)) {
    return source.includes("StudioShell") || source.includes("AdminShell");
  }
  if (fileName === "AuthShell.tsx") {
    return source.includes("publicName") || source.includes("TenantLogo");
  }
  return source.includes("TenantLogo");
}

describe("F2 shell accessibility landmarks", () => {
  for (const fileName of TENANT_SHELLS) {
    it(`${fileName} exposes skip link and main landmark`, () => {
      expect(shellProvidesA11yLandmarks(fileName)).toBe(true);
    });

    it(`${fileName} uses tenant branding in header`, () => {
      expect(shellUsesBranding(fileName)).toBe(true);
    });
  }

  it("platform shell never mounts tenant branding", () => {
    const source = readFileSync(resolve(webRoot, "PlatformConsoleShellClient.tsx"), "utf8");
    expect(source).toContain("Atlas Platform Console");
    expect(source).not.toMatch(/TenantLogo|PublicTenantBranding|logoLightUrl/i);
    expect(source).toContain("OperationalShellLayout");
    expect(layoutSource).toContain("ShellSkipLink");
    expect(layoutSource).toContain('id="main-content"');
  });

  it("shared shell primitives exist", () => {
    const sharedDir = resolve(webRoot, "shared");
    for (const file of [
      "ShellSkipLink.tsx",
      "ShellBottomNav.tsx",
      "OperationalShellLayout.tsx",
      "shell-utils.ts",
    ]) {
      expect(existsSync(resolve(sharedDir, file))).toBe(true);
    }
  });

  it("learner shell keeps mobile bottom navigation", () => {
    const source = readFileSync(resolve(webRoot, "LearnerShellClient.tsx"), "utf8");
    expect(source).toContain('ariaLabel="Mobile learner navigation"');
    expect(source).toContain("ShellBottomNav");
  });
});

describe("F2 shell responsive patterns", () => {
  it("operational shells use shared layout with drawer and sidebar", () => {
    for (const fileName of [
      "ModerationShellClient.tsx",
      "PlatformConsoleShellClient.tsx",
    ]) {
      const source = readFileSync(resolve(webRoot, fileName), "utf8");
      expect(source).toContain("OperationalShellLayout");
    }
  });

  it("admin-style shells use dedicated layout components", () => {
    expect(readFileSync(resolve(webRoot, "StudioShellClient.tsx"), "utf8")).toContain("StudioShell");
    expect(readFileSync(resolve(webRoot, "TenantAdminShellClient.tsx"), "utf8")).toContain("AdminShell");
  });

  it("review shell has mobile navigation drawer", () => {
    const source = readFileSync(resolve(webRoot, "ReviewShellClient.tsx"), "utf8");
    expect(source).toContain("review-mobile-nav");
    expect(source).toContain('aria-label="Review mobile navigation"');
  });

  it("operational layout wires sidebar and bottom nav aria labels", () => {
    const sidebarSource = readFileSync(resolve(webRoot, "shared/ShellSidebarNav.tsx"), "utf8");
    const bottomSource = readFileSync(resolve(webRoot, "shared/ShellBottomNav.tsx"), "utf8");
    expect(layoutSource).toContain("ariaLabel={sidebarAriaLabel}");
    expect(layoutSource).toContain("ariaLabel={bottomNavAriaLabel}");
    expect(sidebarSource).toContain('aria-label={ariaLabel}');
    expect(bottomSource).toContain('aria-label={ariaLabel}');
    expect(layoutSource).toContain('id="main-content"');
    expect(layoutSource).toContain("ShellSkipLink");
  });

  it("review shell gate loads pending workflow count", () => {
    expect(existsSync(resolve(webRoot, "ReviewShellGate.tsx"))).toBe(true);
    const contextSource = readFileSync(
      resolve(import.meta.dirname, "../../../frontend/apps/web/src/lib/server/review-shell-context.ts"),
      "utf8",
    );
    expect(contextSource).toContain("/api/v1/workflows?status=pending");
    expect(contextSource).toContain("pendingReviewCount");
  });
});
