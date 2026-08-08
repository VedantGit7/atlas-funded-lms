import { describe, expect, it } from "vitest";
import {
  buildPublicLandingPage,
  resolvePublicLandingCopy,
} from "@atlas/domain-branding/utils/public-landing-projection";

describe("public landing projection", () => {
  it("resolves flat home copy from branding editor shape", () => {
    const copy = resolvePublicLandingCopy({ headline: "Welcome traders" }, "home");

    expect(copy).toEqual({ headline: "Welcome traders" });
  });

  it("resolves slug-keyed copy for alternate landing pages", () => {
    const copy = resolvePublicLandingCopy(
      {
        home: { headline: "Home headline" },
        promo: { headline: "Promo headline", trustProof: "Limited offer" },
      },
      "promo",
    );

    expect(copy).toEqual({ headline: "Promo headline", trustProof: "Limited offer" });
  });

  it("builds defaults when copy is empty", () => {
    const page = buildPublicLandingPage({
      slug: "home",
      publicName: "Atlas Academy",
      issuerName: "Atlas Issuer",
      copy: {},
    });

    expect(page.headline).toBe("Atlas Academy");
    expect(page.primaryCta).toEqual({ label: "Start diagnostic", href: "/diagnostic" });
    expect(page.secondaryCtas).toHaveLength(2);
  });

  it("builds featured verify href when credential id is configured", () => {
    const page = buildPublicLandingPage({
      slug: "home",
      publicName: "Atlas Academy",
      issuerName: null,
      copy: { featuredCredentialId: "cert-123" },
    });

    expect(page.featuredVerifyHref).toBe("/verify/cert-123");
  });
});
