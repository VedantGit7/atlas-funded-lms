import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantDomainId: "018f0000-0000-7000-8000-000000000002",
  tenantState: "ACTIVE" as const,
  tenantDomainStatus: "ACTIVE" as const,
};

const {
  mockResolveTenantFromRequest,
  mockGetPublicLandingPage,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenantFromRequest: vi.fn(),
  mockGetPublicLandingPage: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      // A bare vi.fn() returns undefined, so any repository doing rows[0] throws.
      // The route pipeline now claims an idempotency key through this tx (M10),
      // which made that latent stub gap visible as a 500.
      $queryRaw: vi.fn().mockResolvedValue([]),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
  ),
}));

vi.mock("@atlas/tenancy", () => ({
  // No recent lookup: resolution goes through the mock below.
  resolveTenantFromRecentLookup: () => null,
  forgetResolvedTenantHosts: () => undefined,
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenantFromRequest(...args),
}));

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

vi.mock("@atlas/domain-branding/services/public-landing.service", () => ({
  getPublicLandingPage: (...args: unknown[]) => mockGetPublicLandingPage(...args),
}));

import { GET } from "../../backend/apps/api/src/app/api/v1/public/landing/[slug]/route";

function createLandingRequest(slug: string, host = "tenant-a.example.com") {
  return new NextRequest(`https://${host}/api/v1/public/landing/${slug}`, {
    method: "GET",
    headers: { host },
  });
}

describe("GET /api/v1/public/landing/:slug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenantFromRequest.mockResolvedValue(tenantA);
    mockGetPublicLandingPage.mockResolvedValue({
      slug: "home",
      publicName: "Acme Academy",
      issuerName: "Acme Issuer",
      headline: "Trade with confidence",
      subheadline: "Start with a free diagnostic.",
      trustProof: "Trusted by 10,000 funded traders",
      primaryCta: { label: "Start diagnostic", href: "/diagnostic" },
      secondaryCtas: [
        { label: "Sign in", href: "/login" },
        { label: "Create account", href: "/signup" },
      ],
      featuredVerifyHref: null,
      footerText: null,
    });
  });

  it("returns landing projection for home slug", async () => {
    const response = await GET(createLandingRequest("home"));
    const body = (await response.json()) as {
      data: { slug: string; headline: string; publicName: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.data.slug).toBe("home");
    expect(body.data.headline).toBe("Trade with confidence");
    expect(body.data.publicName).toBe("Acme Academy");
    expect(mockGetPublicLandingPage).toHaveBeenCalledWith(expect.anything(), "home");
  });
});
