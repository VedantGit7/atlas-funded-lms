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
  mockLookupTenantFromHost,
  mockReadRuntimeBrandingProjection,
  mockResolveBrandingAssetUrl,
  mockReadTenantEmailChannel,
  mockGetLearnerBillingConfigRow,
  mockGetCachedFxRates,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockLookupTenantFromHost: vi.fn(),
  mockReadRuntimeBrandingProjection: vi.fn(),
  mockResolveBrandingAssetUrl: vi.fn(),
  mockReadTenantEmailChannel: vi.fn(),
  mockGetLearnerBillingConfigRow: vi.fn(),
  mockGetCachedFxRates: vi.fn(),
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

vi.mock("@atlas/tenancy", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    lookupTenantFromHost: (...args: unknown[]) => mockLookupTenantFromHost(...args),
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

vi.mock("@atlas/domain-branding", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readRuntimeBrandingProjection: (...args: unknown[]) =>
      mockReadRuntimeBrandingProjection(...args),
  };
});

vi.mock("@atlas/storage", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    resolveBrandingAssetUrl: (...args: unknown[]) => mockResolveBrandingAssetUrl(...args),
  };
});

vi.mock("../../backend/apps/api/src/server/tenant-settings/tenant-settings.service", () => ({
  readTenantEmailChannel: (...args: unknown[]) => mockReadTenantEmailChannel(...args),
}));

vi.mock("@atlas/domain-config/repositories/learner-billing.repository", () => ({
  getLearnerBillingConfigRow: (...args: unknown[]) => mockGetLearnerBillingConfigRow(...args),
}));

vi.mock("@atlas/domain-config/services/fx.service", () => ({
  getCachedFxRates: (...args: unknown[]) => mockGetCachedFxRates(...args),
}));

import { GET } from "../../backend/apps/api/src/app/api/v1/public/bootstrap/route";

function createBootstrapRequest(host = "tenant-a.example.com") {
  return new NextRequest(`https://${host}/api/v1/public/bootstrap`, {
    method: "GET",
    headers: { host },
  });
}

describe("GET /api/v1/public/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupTenantFromHost.mockResolvedValue(tenantA);
    mockReadRuntimeBrandingProjection.mockResolvedValue({
      publicName: "Acme Academy",
      issuerName: "Acme Issuer",
      logoLightRefId: "018f0000-0000-7000-8000-000000000020",
      logoDarkRefId: null,
      faviconRefId: null,
      publicLandingCopy: null,
      themeTokens: {
        primary: "#224466",
        radius: "md",
        modeDefault: "system",
      },
      brandingVersion: 1,
      themeVersion: 1,
    });
    mockReadTenantEmailChannel.mockResolvedValue({
      fromEmail: "support@acme.example.com",
      fromName: "Acme Support",
      enabled: true,
    });
    mockGetLearnerBillingConfigRow.mockResolvedValue({ home_currency: "USD" });
    mockGetCachedFxRates.mockResolvedValue({ data: { base: "USD", rates: { EUR: 0.9 } } });
    mockResolveBrandingAssetUrl.mockImplementation(
      async (_tx: unknown, _ctx: unknown, assetId: string | null) => {
        if (assetId === "018f0000-0000-7000-8000-000000000020") {
          return "https://cdn.example.com/acme-logo.png";
        }
        return null;
      },
    );
  });

  it("returns branding, theme CSS vars, and resolved logo URLs", async () => {
    const response = await GET(createBootstrapRequest());
    const body = (await response.json()) as {
      data: {
        publicName: string | null;
        logoLightUrl: string | null;
        themeCssVars: Record<string, string> | null;
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.publicName).toBe("Acme Academy");
    expect(body.data.logoLightUrl).toBe("https://cdn.example.com/acme-logo.png");
    expect(body.data.themeCssVars?.["--brand-primary"]).toBe("#224466");
    expect(body.data.themeCssVars?.["--radius"]).toBe("0.5rem");
  });
});
