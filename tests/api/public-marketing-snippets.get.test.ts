import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  resolveTenant: vi.fn(),
  forViewer: vi.fn(),
}));

vi.mock("@atlas/api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authenticateTenantRequest: mocks.authenticate,
  resolveRequestTenant: mocks.resolveTenant,
}));
// Outside a real request, Next's cookie store is absent; the request's own cookies are what count.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}),
}));
vi.mock(
  "../../backend/apps/api/src/server/marketing-integrations/marketing-integrations.service",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    getPublicMarketingIntegrationSnippetsForViewer: mocks.forViewer,
  }),
);

import { GET } from "../../backend/apps/api/src/app/api/v1/public/marketing/integrations/snippets/route";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const snippets = {
  data: { siteBodyHtml: "<b>x</b>", orderTrackingHtml: null, signupTrackingHtml: null },
};
const request = (cookie?: string) =>
  new NextRequest("https://academy.example.test/api/v1/public/marketing/integrations/snippets", {
    headers: { "x-forwarded-for": "198.51.100.9", ...(cookie ? { cookie } : {}) },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveTenant.mockResolvedValue({ tenantId });
  mocks.forViewer.mockResolvedValue(snippets);
});

describe("GET /api/v1/public/marketing/integrations/snippets (audit H5)", () => {
  it("serves anonymous visitors without touching authentication, and never caches", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snippets);
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.forViewer).toHaveBeenCalledWith({}, { tenantId, principalId: null });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("decides by the signed-in viewer when a session is presented", async () => {
    mocks.authenticate.mockResolvedValue({
      tenant: { tenantId },
      principal: { id: "principal-1" },
    });
    await GET(request("atlas_access_token=token"));
    expect(mocks.forViewer).toHaveBeenCalledWith({}, { tenantId, principalId: "principal-1" });
  });

  it("serves nothing when a presented session cannot be verified", async () => {
    mocks.authenticate.mockRejectedValue(new Error("expired"));
    const response = await GET(request("atlas_access_token=stale"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { siteBodyHtml: null, orderTrackingHtml: null, signupTrackingHtml: null },
    });
    expect(mocks.forViewer).not.toHaveBeenCalled();
  });
});
