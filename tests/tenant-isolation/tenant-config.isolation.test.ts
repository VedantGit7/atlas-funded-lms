import { describe, expect, it } from "vitest";
import { loadTenantManifest } from "@atlas/tenant-config";

describe("tenant config isolation fixtures", () => {
  it("keeps fundedbeyond and second smoke manifests distinct", () => {
    const fundedbeyond = loadTenantManifest("fundedbeyond");
    const secondSmoke = loadTenantManifest("second-smoke-academy");

    expect(fundedbeyond.tenant.slug).not.toBe(secondSmoke.tenant.slug);
    expect(fundedbeyond.branding.publicName).not.toBe(secondSmoke.branding.publicName);
    expect(fundedbeyond.readiness.ctaPolicy.outboundTargetUrl).not.toBe(
      secondSmoke.readiness.ctaPolicy.outboundTargetUrl,
    );
    expect(JSON.stringify(secondSmoke).toLowerCase()).not.toContain("fundedbeyond");
  });

  it("uses host-scoped domain records per environment without fallback tenant behavior", () => {
    const fundedbeyond = loadTenantManifest("fundedbeyond");
    expect(fundedbeyond.domains.production?.hostname).toBe("academy.fundedbeyond.com");
    expect(fundedbeyond.domains.test?.hostname).toContain("fundedbeyond");
    expect(fundedbeyond.domains.test?.hostname).not.toBe(fundedbeyond.domains.production?.hostname);
  });

  it("gates readiness CTA on legal approval pending state", () => {
    const fundedbeyond = loadTenantManifest("fundedbeyond");
    expect(fundedbeyond.readiness.legalApproval.status).toBe("pending_approval");
    expect(fundedbeyond.readiness.ctaPolicy.ctaCopy).toBeUndefined();
    expect(fundedbeyond.readiness.legalCopy).toBeUndefined();
  });

  it("restricts community spaces to members-only visibility", () => {
    const fundedbeyond = loadTenantManifest("fundedbeyond");
    for (const space of fundedbeyond.communitySpaces) {
      expect(["PRIVATE", "TENANT"]).toContain(space.visibility);
    }
  });
});
