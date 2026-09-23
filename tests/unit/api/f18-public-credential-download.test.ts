import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { setRateLimitStore } from "@atlas/api/rate-limit-store";

const mocks = vi.hoisted(() => ({
  db: {},
  tx: {},
  hit: vi.fn(),
  resolveTenant: vi.fn(),
  download: vi.fn(),
  withGlobalDb: vi.fn(),
  withTenantTx: vi.fn(),
}));
vi.mock("@atlas/tenancy", () => ({ resolveTenantFromRequest: mocks.resolveTenant }));
vi.mock("@atlas/db/global-db", () => ({ withGlobalDb: mocks.withGlobalDb }));
vi.mock("@atlas/db/with-tenant-tx", () => ({ withTenantTx: mocks.withTenantTx }));
vi.mock("../../../backend/apps/api/src/server/certificates/certificate.service", () => ({
  getPublicCredentialDownload: mocks.download,
}));

const credentialId = "cred_018f0000000070008000000000000040";
const requestId = "req_018f0000-0000-7000-8000-000000000040";
const request = (id = credentialId) =>
  new NextRequest(`https://tenant.example.test/api/v1/public/credentials/${id}/download`, {
    headers: { "x-request-id": requestId, "x-forwarded-for": "198.51.100.19" },
  });
async function loadRoute() {
  expect(
    existsSync(
      resolve(
        "backend/apps/api/src/app/api/v1/public/credentials/[credentialId]/download/route.ts",
      ),
    ),
  ).toBe(true);
  return import("../../../backend/apps/api/src/app/api/v1/public/credentials/[credentialId]/download/route");
}

describe("F18 canonical public credential download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("RATE_LIMIT_REDIS_URL", "");
    mocks.hit.mockResolvedValue({ count: 1, resetAt: Date.now() + 60000 });
    setRateLimitStore({
      kind: "redis",
      hit: mocks.hit,
      reset: async () => {},
      close: async () => {},
    });
    mocks.withGlobalDb.mockImplementation((callback) => callback(mocks.db));
    mocks.withTenantTx.mockImplementation((_context, callback) => callback(mocks.tx));
    mocks.resolveTenant.mockResolvedValue({ tenantId: "tenant-a" });
    mocks.download.mockResolvedValue({
      filename: "certificate-cred.html",
      contentType: "text/html; charset=utf-8",
      body: "<html>Issued certificate</html>",
    });
  });
  afterEach(() => {
    setRateLimitStore(null);
    vi.unstubAllEnvs();
  });

  it("serves HTML through the tenant-scoped canonical service without shared caching", async () => {
    const { GET } = await loadRoute();
    const req = request();
    const response = await GET(req);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>Issued certificate</html>");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="certificate-cred.html"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(mocks.resolveTenant).toHaveBeenCalledWith({ req, db: mocks.db });
    expect(mocks.withTenantTx).toHaveBeenCalledWith(
      { tenantId: "tenant-a", requestId, allowAnonymousTenantRead: true },
      expect.any(Function),
    );
    expect(mocks.download).toHaveBeenCalledWith({
      tx: mocks.tx,
      tenantId: "tenant-a",
      requestId,
      credentialId,
    });
  });

  it("preserves binary PDF bytes and attachment headers", async () => {
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0, 0xff]);
    mocks.download.mockResolvedValue({
      filename: "certificate-cred.pdf",
      contentType: "application/pdf",
      body: bytes,
    });
    const response = await (await loadRoute()).GET(request());
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="certificate-cred.pdf"',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes));
  });

  it("validates canonical credential length bounds before service access", async () => {
    const response = await (await loadRoute()).GET(request("x".repeat(129)));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it.each([404, 409])(
    "preserves canonical service status %s and safe error envelopes",
    async (status) => {
      mocks.download.mockRejectedValue(
        new AtlasHttpError({
          code: status === 404 ? "PERMISSION_DENIED" : "VALIDATION_ERROR",
          status,
          message: "Credential unavailable",
        }),
      );
      const response = await (await loadRoute()).GET(request());
      expect(response.status).toBe(status);
      expect((await response.json()).error.requestId).toBe(requestId);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("does not reveal internal service failures", async () => {
    mocks.download.mockRejectedValue(new Error("private storage token"));
    const response = await (await loadRoute()).GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private storage token");
  });

  it("enforces the public read limit before tenant or service work", async () => {
    mocks.hit.mockResolvedValue({ count: 121, resetAt: Date.now() + 60000 });
    const response = await (await loadRoute()).GET(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mocks.resolveTenant).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
