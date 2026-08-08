import { describe, expect, it } from "vitest";
import { loadTenantManifest, parseTenantManifest, validateManifest } from "@atlas/tenant-config";

describe("tenant manifest schema", () => {
  it("loads and validates fundedbeyond manifest", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    expect(manifest.tenant.slug).toBe("fundedbeyond");
    expect(manifest.entitlements.map((entry) => entry.key)).toEqual([
      "branding.custom_domain.enable",
      "community.enable",
      "community.private_spaces.enable",
      "certification.enable",
      "gamification.enable",
      "analytics.dashboard.view",
      "data.export.enable",
    ]);
    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
  });

  it("loads and validates second smoke manifest without fundedbeyond leakage", () => {
    const manifest = loadTenantManifest("second-smoke-academy");
    const serialized = JSON.stringify(manifest).toLowerCase();
    expect(serialized).not.toContain("fundedbeyond");
    expect(manifest.readiness.ctaPolicy.outboundTargetUrl).toBe(
      "https://example.com/education-handoff",
    );
    expect(validateManifest(manifest).valid).toBe(true);
  });

  it("rejects tenant_id in manifest payload", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    expect(() =>
      parseTenantManifest({
        ...manifest,
        tenant_id: "018f0000-0000-7000-8000-000000000099",
      }),
    ).toThrow();
  });

  it("rejects overlapping scoring bands", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    const invalid = {
      ...manifest,
      scoring: {
        ...manifest.scoring,
        bands: [
          { key: "a", label: "A", minScore: 0, maxScore: 60, sortOrder: 1 },
          { key: "b", label: "B", minScore: 50, maxScore: 100, sortOrder: 2 },
        ],
      },
    };
    expect(validateManifest(invalid).valid).toBe(false);
  });

  it("rejects approved legal gate without reference", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    expect(() =>
      parseTenantManifest({
        ...manifest,
        readiness: {
          ...manifest.readiness,
          legalApproval: { status: "approved", reference: null },
        },
      }),
    ).toThrow();
  });

  it("rejects checkout and inbound event references in manifest strings", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    const invalid = {
      ...manifest,
      tenantConfigJson: {
        note: "challenge.purchased handler",
      },
    };
    expect(validateManifest(invalid).valid).toBe(false);
  });

  it("keeps learning paths draft-only", () => {
    const manifest = loadTenantManifest("fundedbeyond");
    for (const path of manifest.learningPaths) {
      expect(["draft", "unavailable"]).toContain(path.availability);
    }
  });
});
