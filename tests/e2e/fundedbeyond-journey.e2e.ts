import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadTenantManifest } from "@atlas/tenant-config";
import { scanRuntimeForFundedBeyondFork } from "@atlas/tenant-config/security-scan";
import { resolveSplitPath, splitPathExists } from "./split-layout-paths";

const configsRoot = resolve(import.meta.dirname, "../../configs/tenants");

const fundedBeyondJourneyPaths = [
  "app/(public)/diagnostic/page.tsx",
  "app/(learner)/readiness/page.tsx",
  "app/(learner)/swipe/page.tsx",
  "app/api/v1/public/diagnostic/start/route.ts",
  "app/api/v1/diagnostic/start/route.ts",
  "app/api/v1/practice-sessions/route.ts",
  "app/api/v1/cta/attribution-token/route.ts",
  "features/diagnostics/components/PublicDiagnosticRunner.tsx",
  "features/diagnostics/components/DiagnosticIdentityGate.tsx",
  "features/readiness/components/ReadinessCtaCard.tsx",
  "modules/readiness/readiness.api-client.ts",
];

describe("FundedBeyond journey e2e wiring", () => {
  it("manifest is host/config driven without runtime fork", () => {
    const manifest = loadTenantManifest("fundedbeyond", configsRoot);
    expect(manifest.tenant.slug).toBe("fundedbeyond");
    expect(manifest.domains.test?.hostname).toBeTruthy();
    expect(manifest.branding.publicName).toContain("FundedBeyond");
  });

  it("includes diagnostic → path → swipe → readiness → external CTA loop", () => {
    for (const relativePath of fundedBeyondJourneyPaths) {
      expect(splitPathExists(relativePath)).toBe(true);
    }
  });

  it("does not wire checkout, payment, or trading account flows", () => {
    const readinessCta = readFileSync(
      resolveSplitPath("features/readiness/components/ReadinessCtaCard.tsx"),
      "utf8",
    );
    expect(readinessCta).not.toMatch(/checkout|payment|trading account/i);
    expect(readinessCta).toContain("external");
  });

  it("passes no-fork scanner for runtime product code", () => {
    const violations = scanRuntimeForFundedBeyondFork({
      roots: ["frontend/apps/web/src"],
    });
    expect(violations).toEqual([]);
  });

  it("negative tenant assertion: second smoke manifest excludes FundedBeyond branding", () => {
    const secondSmoke = loadTenantManifest("second-smoke-academy", configsRoot);
    const serialized = JSON.stringify(secondSmoke).toLowerCase();
    expect(serialized).not.toContain("fundedbeyond");
    expect(secondSmoke.tenant.slug).toBe("second-smoke-academy");
  });
});
