import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ATLAS_PLATFORM_REASON_HEADER } from "@atlas/core/http/headers";
import { createPlatformIdempotencyStore } from "../helpers/platform-idempotency-tx";

const replayStore = createPlatformIdempotencyStore();

const mocks = vi.hoisted(() => ({
  requirePlatformPrincipal: vi.fn(),
  listPlatformTenantDomains: vi.fn(),
  addPlatformTenantCustomDomain: vi.fn(),
  verifyPlatformTenantDomain: vi.fn(),
  setPlatformTenantPrimaryDomain: vi.fn(),
  forgetResolvedTenantHosts: vi.fn(),
}));

vi.mock("@atlas/auth/platform-auth", () => ({
  requirePlatformPrincipal: (...args: unknown[]) => mocks.requirePlatformPrincipal(...args),
}));
vi.mock("@atlas/domain-tenancy", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listPlatformTenantDomains: mocks.listPlatformTenantDomains,
  addPlatformTenantCustomDomain: mocks.addPlatformTenantCustomDomain,
  verifyPlatformTenantDomain: mocks.verifyPlatformTenantDomain,
  setPlatformTenantPrimaryDomain: mocks.setPlatformTenantPrimaryDomain,
}));
vi.mock("@atlas/tenancy", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  forgetResolvedTenantHosts: mocks.forgetResolvedTenantHosts,
}));
vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() }),
}));
vi.mock("@atlas/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // The pipeline claims the idempotency key through this transaction (M10).
  withPlatformScope: (_ctx: unknown, _reason: string, fn: (tx: unknown) => unknown) =>
    fn(
      replayStore.wrap({
        $queryRaw: vi.fn().mockResolvedValue([]),
        $queryRawUnsafe: vi.fn().mockResolvedValue([]),
        $executeRaw: vi.fn().mockResolvedValue(0),
        $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      }),
    ),
}));

import {
  GET,
  POST,
} from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/domains/route";
import { POST as VERIFY } from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/domains/[domainId]/verify/route";
import { POST as PRIMARY } from "../../backend/apps/api/src/app/api/v1/platform/tenants/[id]/domains/[domainId]/primary/route";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const domainId = "018f0000-0000-7000-8000-000000000002";
const reason = "Launch plan 2.6 staging tenant domain";
const domain = {
  id: domainId,
  hostname: "academy.acme-learning.example.com",
  type: "CUSTOM_DOMAIN",
  status: "ACTIVE",
  isPrimary: false,
  verification: null,
  failureReason: null,
  createdAt: "2026-10-30T00:00:00.000Z",
};

let key = 0;
function request(path: string, method: "GET" | "POST", body?: unknown) {
  key += 1;
  return new NextRequest(
    `https://platform.example.com/api/v1/platform/tenants/${tenantId}${path}`,
    {
      method,
      headers: {
        host: "platform.example.com",
        origin: "https://platform.example.com",
        authorization: "Bearer platform-token",
        "content-type": "application/json",
        "idempotency-key": `idem_domains_${String(key)}`,
        [ATLAS_PLATFORM_REASON_HEADER]: reason,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}

const tenantParams = { params: Promise.resolve({ id: tenantId }) };
const domainParams = { params: Promise.resolve({ id: tenantId, domainId }) };

describe("platform tenant domain routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformPrincipal.mockResolvedValue({
      platformPrincipalId: "018f0000-0000-7000-8000-000000000010",
      platformPermissions: ["platform.tenant.read", "platform.tenant.manage"],
    });
    mocks.listPlatformTenantDomains.mockResolvedValue({ data: [domain] });
    mocks.addPlatformTenantCustomDomain.mockResolvedValue({
      data: { ...domain, status: "PENDING" },
    });
    mocks.verifyPlatformTenantDomain.mockResolvedValue({ data: domain });
    mocks.setPlatformTenantPrimaryDomain.mockResolvedValue({
      data: { ...domain, isPrimary: true },
    });
  });

  it("lists with read access", async () => {
    const response = await GET(request("/domains", "GET"), tenantParams);
    expect(response.status).toBe(200);
    expect(mocks.requirePlatformPrincipal).toHaveBeenCalledWith(
      expect.objectContaining({ requiredPermission: "platform.tenant.read" }),
    );
  });

  it("adds with manage access, keeping the platform's own host off-limits", async () => {
    vi.stubEnv("PLATFORM_HOST", "Platform.Example.com");
    try {
      const response = await POST(
        request("/domains", "POST", { hostname: "academy.acme-learning.example.com", reason }),
        tenantParams,
      );
      expect(response.status).toBe(200);
      expect(mocks.requirePlatformPrincipal).toHaveBeenCalledWith(
        expect.objectContaining({ requiredPermission: "platform.tenant.manage" }),
      );
      expect(mocks.addPlatformTenantCustomDomain).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ reason }),
        tenantId,
        { hostname: "academy.acme-learning.example.com" },
        { reservedHostnames: ["platform.example.com"] },
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("verifies with a DNS lookup and drops cached host lookups after", async () => {
    const response = await VERIFY(
      request(`/domains/${domainId}/verify`, "POST", { reason }),
      domainParams,
    );
    expect(response.status).toBe(200);
    expect(mocks.verifyPlatformTenantDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason }),
      tenantId,
      domainId,
      expect.any(Function),
    );
    expect(mocks.forgetResolvedTenantHosts).toHaveBeenCalledOnce();
  });

  it("makes a domain primary and drops cached host lookups after", async () => {
    const response = await PRIMARY(
      request(`/domains/${domainId}/primary`, "POST", { reason }),
      domainParams,
    );
    expect(response.status).toBe(200);
    expect(mocks.setPlatformTenantPrimaryDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason }),
      tenantId,
      domainId,
    );
    expect(mocks.forgetResolvedTenantHosts).toHaveBeenCalledOnce();
  });

  it("keeps the cache when a change is refused", async () => {
    const { AtlasHttpError } = await import("@atlas/core/http/errors");
    mocks.setPlatformTenantPrimaryDomain.mockRejectedValue(
      new AtlasHttpError({ code: "VALIDATION_ERROR", status: 409, message: "not active" }),
    );
    const response = await PRIMARY(
      request(`/domains/${domainId}/primary`, "POST", { reason }),
      domainParams,
    );
    expect(response.status).toBe(409);
    expect(mocks.forgetResolvedTenantHosts).not.toHaveBeenCalled();
  });
});
