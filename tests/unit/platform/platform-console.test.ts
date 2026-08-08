import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PLATFORM_ROUTE_REGISTRY } from "../../../frontend/apps/web/src/features/platform/platform-route-registry";
import {
  PLATFORM_PRIMARY_NAV,
  filterPlatformNavigation,
} from "../../../frontend/apps/web/src/features/platform/platform-navigation";
import { projectPlatformCapabilities } from "../../../frontend/apps/web/src/features/platform/platform-capability-projection";
import { platformQueryKey } from "../../../frontend/apps/web/src/features/platform/platform-query-keys";
import { tenantQueryKey } from "../../../frontend/apps/web/src/lib/query/client-data-cache";
import { platformReasonSchema } from "../../../frontend/apps/web/src/features/platform/platform-reason-schema";

const webRoot = resolve(import.meta.dirname, "../../../frontend/apps/web/src");

describe("platform route registry", () => {
  it("maps P1-P8 only", () => {
    expect(PLATFORM_ROUTE_REGISTRY.map((entry) => entry.screenId)).toEqual([
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
      "P6",
      "P7",
      "P8",
    ]);
  });

  it("does not include analytics billing or system configuration routes", () => {
    const paths = PLATFORM_ROUTE_REGISTRY.map((entry) => entry.pathPattern).join("\n");
    expect(paths).not.toMatch(/analytics|billing|system/i);
  });
});

describe("platform navigation capability filtering", () => {
  it("hides catalog from operations capability projection", () => {
    const capabilities = projectPlatformCapabilities([
      "platform.tenant.read",
      "platform.tenant.manage",
      "platform.feature_flag.manage",
      "platform.audit.read",
      "platform.support.access",
    ]);
    const items = filterPlatformNavigation(PLATFORM_PRIMARY_NAV, capabilities);
    expect(items.some((item) => item.screenId === "P5")).toBe(false);
    expect(items.some((item) => item.screenId === "P4")).toBe(true);
  });

  it("does not expose tenant admin learner studio or moderation links", () => {
    const navSource = readFileSync(
      resolve(webRoot, "features/platform/platform-navigation.ts"),
      "utf8",
    );
    expect(navSource).not.toMatch(/\/admin|\/studio|\/moderate|\/learn/);
  });
});

describe("platform reason and cache isolation", () => {
  it("requires at least 10 characters", () => {
    expect(platformReasonSchema.safeParse("short").success).toBe(false);
    expect(platformReasonSchema.safeParse("valid reason").success).toBe(true);
  });

  it("keeps platform query keys distinct from tenant keys", () => {
    expect(platformQueryKey(["tenants"])[0]).toBe("platform");
    expect(tenantQueryKey("tenant-a", ["members"])[0]).toBe("tenant");
    expect(JSON.stringify(platformQueryKey(["tenants"]))).not.toBe(
      JSON.stringify(tenantQueryKey("tenant-a", ["tenants"])),
    );
  });

  it("does not persist reason in browser storage", () => {
    const provider = readFileSync(
      resolve(webRoot, "features/platform/components/PlatformReasonProvider.tsx"),
      "utf8",
    );
    expect(provider).not.toMatch(/localStorage|sessionStorage/);
  });
});

describe("platform shell wiring", () => {
  it("includes platform shell gate and isolated client shell", () => {
    expect(existsSync(resolve(webRoot, "components/shells/PlatformConsoleShellGate.tsx"))).toBe(
      true,
    );
    const client = readFileSync(
      resolve(webRoot, "components/shells/PlatformConsoleShellClient.tsx"),
      "utf8",
    );
    expect(client).toContain("Atlas Platform Console");
    expect(client).not.toMatch(/TenantAdminShell|tenant branding|publicName/i);
  });

  it("enforces platform host gate in shell context", () => {
    const source = readFileSync(resolve(webRoot, "lib/server/platform-shell-context.ts"), "utf8");
    expect(source).toContain("resolvePlatformHost");
    expect(source).toContain("host_blocked");
  });
});

describe("P7/P8 restrictions", () => {
  it("does not expose tenant impersonation controls", () => {
    const support = readFileSync(
      resolve(webRoot, "features/platform/components/SupportSessionPanel.tsx"),
      "utf8",
    );
    expect(support).not.toMatch(
      /impersonat|mint.*tenant.*token|tenant session switch|href=.*\/login/i,
    );
  });

  it("does not implement client-side dead-letter replay worker", () => {
    const eventing = readFileSync(
      resolve(webRoot, "features/platform/components/DeadLetterEventTable.tsx"),
      "utf8",
    );
    expect(eventing).toContain("/api/v1/internal/outbox/dead-letter/");
    expect(eventing).not.toMatch(/insertIntoOutbox|rerunWorker|manual.*event/i);
  });
});
