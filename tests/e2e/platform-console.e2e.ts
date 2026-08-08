import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

describe("platform console e2e wiring", () => {
  it("includes all P1-P8 page files", () => {
    const pages = [
      "app/platform/page.tsx",
      "app/platform/tenants/new/page.tsx",
      "app/platform/tenants/[id]/page.tsx",
      "app/platform/feature-flags/page.tsx",
      "app/platform/catalog/page.tsx",
      "app/platform/audit/page.tsx",
      "app/platform/support/page.tsx",
      "app/platform/eventing/page.tsx",
    ];

    for (const page of pages) {
      expect(existsSync(resolve(webRoot, page))).toBe(true);
    }
  });

  it("platform shell exposes mobile navigation affordances", () => {
    const source = readFileSync(
      resolve(webRoot, "components/shells/PlatformConsoleShellClient.tsx"),
      "utf8",
    );
    expect(source).toContain("platform-mobile-nav");
    expect(source).toContain("Mobile platform navigation");
  });

  it("keeps platform and tenant caches isolated", () => {
    const platformCache = readFileSync(
      resolve(webRoot, "lib/query/platform-data-cache.ts"),
      "utf8",
    );
    const tenantCache = readFileSync(resolve(webRoot, "lib/query/client-data-cache.ts"), "utf8");
    expect(platformCache).toContain("clearPlatformClientDataCache");
    expect(tenantCache).toContain("clearClientDataCache");
    expect(platformCache).not.toContain("tenantQueryKey");
  });

  it("platform feature flags editor supports update via PUT", () => {
    const source = readFileSync(
      resolve(webRoot, "features/platform/components/GlobalFeatureFlagEditor.tsx"),
      "utf8",
    );
    expect(source).toContain("platformApi.put");
    expect(source).toContain("Edit");
  });

  it("platform pages use server-side page gates", () => {
    const page = readFileSync(resolve(webRoot, "app/platform/feature-flags/page.tsx"), "utf8");
    expect(page).toContain("PlatformPageGate");
    expect(page).toContain("canFeatureFlagManage");
  });
});
