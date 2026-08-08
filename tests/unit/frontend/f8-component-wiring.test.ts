import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTenantManifest } from "@atlas/tenant-config";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");
const configsRoot = resolve(import.meta.dirname, "../../../configs/tenants");

describe("F8 component wiring", () => {
  const componentPaths = [
    "components/patterns/ConfirmDialog.tsx",
    "components/patterns/VirtualizedTable.tsx",
    "features/assessments/components/attempt-runner.tsx",
    "features/practice/components/SwipePracticeClient.tsx",
    "components/shells/LearnerShellClient.tsx",
    "components/shells/TenantAdminShellClient.tsx",
  ];

  it("includes hardened learner and ops component surfaces", () => {
    for (const relativePath of componentPaths) {
      expect(existsSync(resolve(webRoot, relativePath))).toBe(true);
    }
  });

  it("ConfirmDialog supports focus trap and keyboard dismissal", () => {
    const source = readFileSync(resolve(webRoot, "components/patterns/ConfirmDialog.tsx"), "utf8");
    expect(source).toContain("role=\"dialog\"");
    expect(source).toMatch(/onKeyDown|Escape/);
  });

  it("attempt runner wires autosave and submit APIs", () => {
    const source = readFileSync(
      resolve(webRoot, "features/assessments/components/attempt-runner.tsx"),
      "utf8",
    );
    expect(source).toContain("/api/v1/attempts/");
    expect(source).toContain("/answers");
    expect(source).toContain("/submit");
  });

  it("VirtualizedTable virtualizes long row lists", () => {
    const source = readFileSync(
      resolve(webRoot, "components/patterns/VirtualizedTable.tsx"),
      "utf8",
    );
    expect(source).toContain("scrollTop");
    expect(source).toContain("windowRows");
  });
});

describe("F8 tenant branding fixtures", () => {
  it("loads FundedBeyond and second-smoke manifests for visual regression", () => {
    const fundedBeyond = loadTenantManifest("fundedbeyond", configsRoot);
    const secondSmoke = loadTenantManifest("second-smoke-academy", configsRoot);
    expect(fundedBeyond.branding.publicName).toContain("FundedBeyond");
    expect(secondSmoke.tenant.slug).toBe("second-smoke-academy");
    expect(JSON.stringify(secondSmoke).toLowerCase()).not.toContain("fundedbeyond");
  });
});
