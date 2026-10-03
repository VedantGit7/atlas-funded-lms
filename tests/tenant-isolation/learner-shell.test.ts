import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const { mockResetPostHogBrowser } = vi.hoisted(() => ({ mockResetPostHogBrowser: vi.fn() }));

// clearClientDataCache("host_change") resets analytics identity through a fire-and-forget dynamic
// import. Left unmocked and unawaited, that import could finish loading after this file's
// environment was torn down, which Vitest reports as an EnvironmentTeardownError (seen in CI).
vi.mock("../../frontend/apps/web/src/observability/posthog-browser", () => ({
  resetPostHogBrowser: mockResetPostHogBrowser,
}));

import {
  clearClientDataCache,
  tenantQueryKey,
  writeClientDataCache,
  readClientDataCache,
} from "../../frontend/apps/web/src/lib/query/client-data-cache";

const webRoot = resolve(import.meta.dirname, "../../frontend/apps/web/src");

describe("learner tenant isolation frontend guards", () => {
  it("does not send tenant_id from learner pages or shell", () => {
    const files = [
      "components/shells/LearnerShellClient.tsx",
      "components/shells/LearnerShellGate.tsx",
      "lib/server/learner-shell-context.ts",
      "app/profile/page.tsx",
      "features/learner/components/ProfileForm.tsx",
    ];

    for (const relativePath of files) {
      const source = readFileSync(resolve(webRoot, relativePath), "utf8");
      expect(source).not.toMatch(/tenant_id|tenantId.*searchParams|localStorage/);
    }
  });

  it("prevents query cache crossover across tenant scopes", () => {
    writeClientDataCache(tenantQueryKey("tenant-a.host", ["courses"]), {
      title: "Tenant A course",
    });
    writeClientDataCache(tenantQueryKey("tenant-b.host", ["courses"]), {
      title: "Tenant B course",
    });

    expect(readClientDataCache(tenantQueryKey("tenant-a.host", ["courses"]))).toEqual({
      title: "Tenant A course",
    });
    expect(readClientDataCache(tenantQueryKey("tenant-b.host", ["courses"]))).toEqual({
      title: "Tenant B course",
    });

    clearClientDataCache("host_change");
    expect(readClientDataCache(tenantQueryKey("tenant-a.host", ["courses"]))).toBeUndefined();
    expect(readClientDataCache(tenantQueryKey("tenant-b.host", ["courses"]))).toBeUndefined();
  });

  it("resets analytics identity when the tenant host changes", async () => {
    mockResetPostHogBrowser.mockClear();
    clearClientDataCache("host_change");
    // Awaited so the reset finishes inside this test instead of racing environment teardown.
    await vi.waitFor(() => {
      expect(mockResetPostHogBrowser).toHaveBeenCalledOnce();
    });
  });

  it("learner navigation projection uses entitlement keys only", () => {
    const source = readFileSync(resolve(webRoot, "features/learner/learner-navigation.ts"), "utf8");
    expect(source).toContain("certification.enable");
    expect(source).toContain("gamification.enable");
    expect(source).toContain("community.enable");
    expect(source).not.toMatch(/tenant\.slug|fundedbeyond|role\.name/);
  });
});
