import { describe, expect, it } from "vitest";
import {
  buildTenantResourceRegistry,
  validateTenantResourceRegistryCoverage,
} from "@atlas/release-readiness";

describe("tenant resource IDOR registry", () => {
  it("builds registry entries from route metadata", () => {
    const entries = buildTenantResourceRegistry();
    expect(entries.length).toBeGreaterThan(20);

    const withLoader = entries.filter((entry) => entry.hasResourceLoader);
    expect(withLoader.length).toBeGreaterThan(10);
  });

  it("requires isolation test coverage for IDOR surfaces", () => {
    const entries = buildTenantResourceRegistry();
    const report = validateTenantResourceRegistryCoverage(entries);

    if (!report.ok) {
      const summary = report.uncovered
        .map((entry) => `${entry.apiPath} (${entry.domain})`)
        .join(", ");
      throw new Error(`Uncovered tenant resources: ${summary}`);
    }

    expect(report.ok).toBe(true);
    expect(report.covered).toBe(report.total);
  });

  it("maps known domains to isolation harness files", () => {
    const entries = buildTenantResourceRegistry();
    const itemRoute = entries.find((entry) => entry.domain === "item-registry");
    expect(itemRoute?.isolationTestFile).toBe("item-registry.test.ts");
  });
});
