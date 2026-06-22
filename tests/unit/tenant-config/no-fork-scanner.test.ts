import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSourceForForkViolations } from "@atlas/tenant-config";

describe("tenant config no-fork scanner", () => {
  it("flags tenant slug conditionals in runtime source", () => {
    const findings = scanSourceForForkViolations(
      "apps/web/src/example.ts",
      'if (tenant.slug === "fundedbeyond") { return true; }',
    );
    expect(findings.length).toBeGreaterThan(0);
  });

  it("allows fundedbeyond references in configs and tests only", () => {
    const manifest = readFileSync(
      resolve(import.meta.dirname, "../../../configs/tenants/fundedbeyond/manifest.json"),
      "utf8",
    );
    const findings = scanSourceForForkViolations(
      "configs/tenants/fundedbeyond/manifest.json",
      manifest,
    );
    expect(findings).toEqual([]);
  });

  it("does not flag generic provisioning service", () => {
    const source = readFileSync(
      resolve(
        import.meta.dirname,
        "../../../packages/domain/tenancy/src/services/platform-tenant-provisioning.service.ts",
      ),
      "utf8",
    );
    const findings = scanSourceForForkViolations(
      "packages/domain/tenancy/src/services/platform-tenant-provisioning.service.ts",
      source,
    );
    expect(findings).toEqual([]);
  });
});
