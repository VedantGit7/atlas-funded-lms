import { describe, expect, it } from "vitest";
import {
  buildAttributionTokenPayload,
  buildOutboundUrl,
  containsUnsafeCopy,
  createAttributionTokenBodySchema,
  ctaPolicyConfigSchema,
  deriveProminence,
  updateReadinessPolicyBodySchema,
} from "../../../backend/apps/api/src/server/readiness/readiness.schemas";
import { mintAttributionTokenValue } from "../../../backend/apps/api/src/server/readiness/cta-attribution.service";

describe("readiness schemas", () => {
  it("rejects tenant_id and client targetUrl", () => {
    expect(() =>
      updateReadinessPolicyBodySchema.parse({
        scoringProfileId: "018f0000-0000-7000-8000-000000000001",
        tenant_id: "018f0000-0000-7000-8000-000000000099",
        ctaPolicy: {
          outboundTargetUrl: "https://example.com/a",
          tokenTtlSeconds: 3600,
          bandProminenceRules: [{ bandKey: "developing", prominence: "hidden" }],
          ctaCopy: {
            headline: "Headline",
            body: "Body",
            buttonLabel: "Go",
          },
        },
        legalCopy: {
          disclaimer: "Educational only.",
          bandNotes: {},
          legalReviewChecklist: ["Reviewed"],
        },
      }),
    ).toThrow();

    expect(() =>
      createAttributionTokenBodySchema.parse({
        sourceSurface: "L12",
        sourcePath: "/readiness",
        targetUrl: "https://evil.example",
      }),
    ).toThrow();
  });

  it("rejects guaranteed funding/pass/profit copy", () => {
    expect(containsUnsafeCopy("This offers guaranteed funding")).toBe(true);
    expect(containsUnsafeCopy("Educational readiness only")).toBe(false);

    expect(() =>
      updateReadinessPolicyBodySchema.parse({
        scoringProfileId: "018f0000-0000-7000-8000-000000000001",
        ctaPolicy: {
          outboundTargetUrl: "https://example.com/a",
          tokenTtlSeconds: 3600,
          bandProminenceRules: [{ bandKey: "ready", prominence: "standard" }],
          ctaCopy: {
            headline: "Guaranteed pass awaits",
            body: "Body",
            buttonLabel: "Go",
          },
        },
        legalCopy: {
          disclaimer: "Educational only.",
          bandNotes: {},
          legalReviewChecklist: ["Reviewed"],
        },
      }),
    ).toThrow();
  });

  it("requires HTTPS CTA target URL", () => {
    expect(() =>
      ctaPolicyConfigSchema.parse({
        outboundTargetUrl: "http://example.com/a",
        tokenTtlSeconds: 3600,
        bandProminenceRules: [{ bandKey: "ready", prominence: "standard" }],
        ctaCopy: {
          headline: "Headline",
          body: "Body",
          buttonLabel: "Go",
        },
      }),
    ).toThrow(/HTTPS/);
  });

  it("requires unique band prominence rules", () => {
    expect(() =>
      ctaPolicyConfigSchema.parse({
        outboundTargetUrl: "https://example.com/a",
        tokenTtlSeconds: 3600,
        bandProminenceRules: [
          { bandKey: "ready", prominence: "hidden" },
          { bandKey: "ready", prominence: "prominent" },
        ],
        ctaCopy: {
          headline: "Headline",
          body: "Body",
          buttonLabel: "Go",
        },
      }),
    ).toThrow(/unique/i);
  });

  it("derives prominence from policy and band", () => {
    const rules = [
      { bandKey: "developing", prominence: "hidden" as const },
      { bandKey: "proficient", prominence: "prominent" as const },
    ];

    expect(deriveProminence("proficient", rules)).toBe("prominent");
    expect(deriveProminence("unknown", rules)).toBe("hidden");
  });

  it("bounds token ttl and excludes PII from token payload helper", () => {
    expect(() =>
      ctaPolicyConfigSchema.parse({
        outboundTargetUrl: "https://example.com/a",
        tokenTtlSeconds: 30,
        bandProminenceRules: [{ bandKey: "ready", prominence: "standard" }],
        ctaCopy: {
          headline: "Headline",
          body: "Body",
          buttonLabel: "Go",
        },
      }),
    ).toThrow();

    const token = mintAttributionTokenValue();
    expect(token.length).toBeGreaterThan(20);

    const payload = buildAttributionTokenPayload({
      tokenId: "018f0000-0000-7000-8000-000000000001",
      tenantId: "018f0000-0000-7000-8000-000000000002",
      membershipId: "018f0000-0000-7000-8000-000000000003",
      sourceSurface: "L12",
      sourcePath: "/readiness",
      readinessBandKey: "proficient",
    });

    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("name");
    expect(buildOutboundUrl("https://example.com/handoff", token)).toContain("attribution_token=");
  });
});
