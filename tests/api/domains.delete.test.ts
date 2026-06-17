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
const otherTenantDomainId = "018f0000-0000-7000-8000-000000000099";

const deletedDomain = {
  data: {
    id: domainId,
    status: "DISABLED" as const,
  },
};

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockDeleteTenantDomain,
  mockWithGlobalDb,
  mockWithTenantTx,
  disableTenantDomainMock,
  auditWriterWriteMock,
  outboxPublishMock,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockDeleteTenantDomain: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }),
  ),
  disableTenantDomainMock: vi.fn(),
  auditWriterWriteMock: vi.fn(),
  outboxPublishMock: vi.fn(),
}));

async function getRealDeleteTenantDomain() {
  const mod = await vi.importActual<typeof DomainAdminModule>(
    "@atlas/domain-branding/services/domain-admin.service",
  );
  return mod.deleteTenantDomain;
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
    enforceEntitlement: vi.fn(),
  };
});

vi.mock("@atlas/domain-branding/repositories/domain.repository", () => ({
  disableTenantDomain: (...args: unknown[]) => disableTenantDomainMock(...args),
  findDomainByHostname: vi.fn(),
  insertTenantDomain: vi.fn(),
  listTenantDomains: vi.fn(),
}));

vi.mock("@atlas/domain-branding", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    deleteTenantDomain: (...args: unknown[]) => mockDeleteTenantDomain(...args),
  };
});

vi.mock("@atlas/audit", () => ({
  auditWriter: {
    write: (...args: unknown[]) => auditWriterWriteMock(...args),
  },
}));

vi.mock("@atlas/events", () => ({
  outbox: {
    publish: (...args: unknown[]) => outboxPublishMock(...args),
  },
}));

import { DELETE } from "../../apps/web/src/app/api/v1/domains/[id]/route";
import { routeMetadata } from "../../apps/web/src/app/api/v1/domains/[id]/route.metadata";

function setupAuthenticatedAdmin() {
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
    permission: "tenancy.domain.manage",
    reason: "ALLOWED",
    matchedRoleKeys: ["admin"],
    bypassedResourcePredicate: true,
  });
}

function createDeleteRequest(headers: Record<string, string> = {}) {
  return new NextRequest(`https://tenant-a.example.com/api/v1/domains/${domainId}`, {
    method: "DELETE",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
      "idempotency-key": "domain-delete-key-001",
      ...headers,
    },
  });
}

function routeContext(domainIdParam: string) {
  return { params: Promise.resolve({ id: domainIdParam }) };
}

describe("DELETE /api/v1/domains/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin();
    mockDeleteTenantDomain.mockResolvedValue(deletedDomain);
    disableTenantDomainMock.mockResolvedValue({ id: domainId, status: "DISABLED" });
    auditWriterWriteMock.mockResolvedValue(undefined);
    outboxPublishMock.mockResolvedValue({ id: "018f0000-0000-7000-8000-000000000030" });
  });

  it("requires tenancy.domain.manage permission at the route layer", () => {
    expect(routeMetadata.permission).toBe("tenancy.domain.manage");
  });

  it("lets users with tenancy.domain.manage delete a tenant domain", async () => {
    const response = await DELETE(createDeleteRequest(), routeContext(domainId));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(deletedDomain);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "tenancy.domain.manage",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: adminMembershipId,
        }),
      }),
    );
    expect(mockDeleteTenantDomain).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: tenantA.tenantId,
        actorMembershipId: adminMembershipId,
      }),
      domainId,
    );
  });

  it("disables the domain row instead of hard-deleting it", async () => {
    mockDeleteTenantDomain.mockImplementation(await getRealDeleteTenantDomain());

    const response = await DELETE(createDeleteRequest(), routeContext(domainId));
    const body = (await response.json()) as typeof deletedDomain;

    expect(response.status).toBe(200);
    expect(disableTenantDomainMock).toHaveBeenCalledWith(expect.anything(), domainId);
    expect(body.data).toEqual({
      id: domainId,
      status: "DISABLED",
    });
  });

  it("writes audit and publishes domain.changed outbox event on delete", async () => {
    mockDeleteTenantDomain.mockImplementation(await getRealDeleteTenantDomain());

    await DELETE(createDeleteRequest(), routeContext(domainId));

    expect(auditWriterWriteMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: tenantA.tenantId,
        actorMembershipId: adminMembershipId,
      }),
      expect.objectContaining({
        action: "tenant.domain.deleted",
        target: { type: "tenant_domain", id: domainId },
        after: { status: "DISABLED" },
      }),
    );
    expect(outboxPublishMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "domain.changed",
        payload: expect.objectContaining({
          tenantId: tenantA.tenantId,
          domainId,
          action: "disabled",
        }),
      }),
    );
  });

  it("cannot delete a domain that belongs to another tenant", async () => {
    mockDeleteTenantDomain.mockImplementation(await getRealDeleteTenantDomain());
    disableTenantDomainMock.mockResolvedValue(null);

    const response = await DELETE(createDeleteRequest(), routeContext(otherTenantDomainId));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).not.toBe(200);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(disableTenantDomainMock).toHaveBeenCalledWith(expect.anything(), otherTenantDomainId);
    expect(auditWriterWriteMock).not.toHaveBeenCalled();
    expect(outboxPublishMock).not.toHaveBeenCalled();
  });

  it("scopes delete operations to the resolved tenant context", async () => {
    await DELETE(createDeleteRequest(), routeContext(domainId));

    expect(mockWithTenantTx).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA.tenantId,
      }),
      expect.any(Function),
    );
  });
});
