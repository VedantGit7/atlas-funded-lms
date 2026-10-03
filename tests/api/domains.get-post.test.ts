import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as DomainAdminModule from "@atlas/domain-branding/services/domain-admin.service";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";
const domainId = "018f0000-0000-7000-8000-000000000020";

const domainsPayload = {
  data: [
    {
      id: domainId,
      hostname: "learn.example.com",
      type: "CUSTOM_DOMAIN" as const,
      status: "PENDING" as const,
      isPrimary: false,
      verificationTxtName: "_atlas-verify.learn.example.com",
      verificationTxtValue: "atlas=0123456789abcdef0123456789abcdef0123456789abcdef",
      failureReason: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

const createdCustomDomain = domainsPayload.data[0];

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockReadTenantDomains,
  mockCreateTenantDomain,
  mockWithGlobalDb,
  mockWithTenantTx,
  findDomainByHostnameMock,
  insertTenantDomainMock,
  findActiveEntitlementByKeyMock,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockReadTenantDomains: vi.fn(),
  mockCreateTenantDomain: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      // A successful mutation must own a returned claim; an empty INSERT result
      // correctly fails closed after F03. Other fixture queries return no rows.
      $queryRaw: vi.fn(async (sql: TemplateStringsArray) =>
        sql.join("").includes("INSERT INTO idempotency_records")
          ? [{ id: "018f0000-0000-7000-8000-000000000088" }]
          : [],
      ),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
  ),
  findDomainByHostnameMock: vi.fn(),
  insertTenantDomainMock: vi.fn(),
  findActiveEntitlementByKeyMock: vi.fn(),
}));

async function getRealCreateTenantDomain() {
  const mod = await vi.importActual<typeof DomainAdminModule>(
    "@atlas/domain-branding/services/domain-admin.service",
  );
  return mod.createTenantDomain;
}

vi.mock("@atlas/tenancy", () => ({
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/auth", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireSupabaseUser: (...args: unknown[]) => mockRequireSupabaseUser(...args),
    upsertAuthPrincipal: (...args: unknown[]) => mockUpsertAuthPrincipal(...args),
  };
});

vi.mock("@atlas/membership", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireActiveMembership: (...args: unknown[]) => mockRequireActiveMembership(...args),
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

vi.mock("@atlas/authorization", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    can: (...args: unknown[]) => mockCan(...args),
    enforceEntitlement: actual.enforceEntitlement,
  };
});

vi.mock("@atlas/domain-config", async () => {
  // The gate now reads value_json on every call, so the parse is real here:
  // mocking it would hide whether `{ enabled: false }` actually denies.
  const { parseEntitlementValue } = (await vi.importActual(
    "@atlas/domain-config/schemas/entitlement-value",
  )) as {
    parseEntitlementValue: (raw: unknown) => {
      enabled: boolean;
      limit: number | null;
      period: string;
    };
  };
  return {
    parseEntitlementValue,
    findActiveEntitlementByKey: (...args: unknown[]) => findActiveEntitlementByKeyMock(...args),
  };
});

vi.mock("@atlas/domain-branding/repositories/domain.repository", () => ({
  findDomainByHostname: (...args: unknown[]) => findDomainByHostnameMock(...args),
  insertTenantDomain: (...args: unknown[]) => insertTenantDomainMock(...args),
  listTenantDomains: vi.fn(),
  disableTenantDomain: vi.fn(),
}));

vi.mock("@atlas/domain-branding", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readTenantDomains: (...args: unknown[]) => mockReadTenantDomains(...args),
    createTenantDomain: (...args: unknown[]) => mockCreateTenantDomain(...args),
  };
});

vi.mock("@atlas/audit", () => ({
  auditWriter: { write: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@atlas/events", () => ({
  outbox: { publish: vi.fn().mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000099" }) },
}));

import { GET, POST } from "../../backend/apps/api/src/app/api/v1/domains/route";

function setupAuthenticatedAdmin(permission: string) {
  mockResolveTenant.mockResolvedValue(tenantA);
  mockRequireSupabaseUser.mockResolvedValue({
    supabaseUserId: "018f0000-0000-7000-8000-000000000099",
    email: "admin@example.com",
    mfaEnabled: false,
  });
  mockUpsertAuthPrincipal.mockResolvedValue({
    id: "018f0000-0000-7000-8000-000000000098",
    email: "admin@example.com",
  });
  mockRequireActiveMembership.mockResolvedValue({
    membershipId: adminMembershipId,
    status: "ACTIVE",
  });
  mockCan.mockResolvedValue({
    allowed: true,
    permission,
    reason: "ALLOWED",
    matchedRoleKeys: ["admin"],
    bypassedResourcePredicate: true,
  });
}

function createGetRequest(path = "/api/v1/domains") {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
    },
  });
}

function createPostRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://tenant-a.example.com/api/v1/domains", {
    method: "POST",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
      "content-type": "application/json",
      "idempotency-key": "domain-create-key-001",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("GET /api/v1/domains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin("tenancy.domain.read");
    mockReadTenantDomains.mockResolvedValue(domainsPayload);
  });

  it("lets users with tenancy.domain.read list tenant domains", async () => {
    const response = await GET(createGetRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(domainsPayload);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "tenancy.domain.read",
      }),
    );
  });
});

describe("POST /api/v1/domains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin("tenancy.domain.manage");
    mockCreateTenantDomain.mockResolvedValue({ data: createdCustomDomain });
    findDomainByHostnameMock.mockResolvedValue(null);
    findActiveEntitlementByKeyMock.mockResolvedValue({
      key: "branding.custom_domain.enable",
      // The repository selects value_json AS value, and the gate parses it.
      // The old stub carried a bare `enabled` that nothing ever read.
      value: true,
    });
    insertTenantDomainMock.mockResolvedValue({
      id: domainId,
      hostname: "learn.example.com",
      type: "CUSTOM_DOMAIN",
      status: "PENDING",
      is_primary: false,
      verification_txt_name: "_atlas-verify.learn.example.com",
      verification_txt_value: "atlas=0123456789abcdef0123456789abcdef0123456789abcdef",
      failure_reason: null,
      created_at: new Date("2025-01-01T00:00:00.000Z"),
      updated_at: new Date("2025-01-01T00:00:00.000Z"),
    });
  });

  it("lets users with tenancy.domain.manage add a custom domain", async () => {
    const response = await POST(
      createPostRequest({
        hostname: "learn.example.com",
        type: "CUSTOM_DOMAIN",
        makePrimary: false,
      }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: createdCustomDomain });
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "tenancy.domain.manage",
      }),
    );
  });

  it("returns ENTITLEMENT_REQUIRED for custom domains without branding.custom_domain.enable", async () => {
    mockCreateTenantDomain.mockImplementation(await getRealCreateTenantDomain());
    findActiveEntitlementByKeyMock.mockResolvedValue(null);

    const response = await POST(
      createPostRequest({
        hostname: "learn.example.com",
        type: "CUSTOM_DOMAIN",
        makePrimary: false,
      }),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("ENTITLEMENT_REQUIRED");
    expect(insertTenantDomainMock).not.toHaveBeenCalled();
  });

  it("does not require custom-domain entitlement for atlas subdomains", async () => {
    mockCreateTenantDomain.mockImplementation(await getRealCreateTenantDomain());
    insertTenantDomainMock.mockResolvedValueOnce({
      id: "018f0000-0000-7000-8000-000000000030",
      hostname: "tenant-a.localhost.test",
      type: "ATLAS_SUBDOMAIN",
      status: "ACTIVE",
      is_primary: true,
      verification_txt_name: null,
      verification_txt_value: null,
      failure_reason: null,
      created_at: new Date("2025-01-01T00:00:00.000Z"),
      updated_at: new Date("2025-01-01T00:00:00.000Z"),
    });

    const response = await POST(
      createPostRequest({
        hostname: "tenant-a.localhost.test",
        type: "ATLAS_SUBDOMAIN",
        makePrimary: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(findActiveEntitlementByKeyMock).not.toHaveBeenCalled();
    expect(insertTenantDomainMock).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate hostnames", async () => {
    mockCreateTenantDomain.mockImplementation(await getRealCreateTenantDomain());
    findDomainByHostnameMock.mockResolvedValueOnce({ id: domainId, hostname: "learn.example.com" });

    const response = await POST(
      createPostRequest({
        hostname: "learn.example.com",
        type: "CUSTOM_DOMAIN",
        makePrimary: false,
      }),
    );

    expect(response.status).not.toBe(200);
    expect(insertTenantDomainMock).not.toHaveBeenCalled();
  });

  it("requires Idempotency-Key", async () => {
    const response = await POST(
      createPostRequest(
        {
          hostname: "learn.example.com",
          type: "CUSTOM_DOMAIN",
          makePrimary: false,
        },
        { "idempotency-key": "" },
      ),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockCreateTenantDomain).not.toHaveBeenCalled();
  });
});
