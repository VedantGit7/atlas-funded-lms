import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  membershipPending,
  membershipRemoved,
  membershipSuspended,
  noMembership,
} from "@atlas/membership/membership-errors";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockReadTenantAuditLog,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockReadTenantAuditLog: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn() }),
  ),
}));

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
  };
});

vi.mock("@atlas/audit", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    readTenantAuditLog: (...args: unknown[]) => mockReadTenantAuditLog(...args),
  };
});

import { GET } from "../../backend/apps/api/src/app/api/v1/audit/route";

const tenantA = {
  tenantId: "tenant-a-id",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const principal = {
  id: "018f0000-0000-7000-8000-000000000099",
  email: "admin@example.com",
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000088";

const auditPayload = {
  data: [
    {
      id: "018f0000-0000-7000-8000-000000000001",
      occurredAt: "2025-01-01T00:00:00.000Z",
      action: "member.invited",
      targetType: "membership",
      targetId: "018f0000-0000-7000-8000-000000000002",
      actorMembershipId: adminMembershipId,
      platformPrincipalId: null,
      requestId: "req-1",
      reason: null,
      metadata: null,
    },
  ],
  page: {
    hasMore: false,
    nextCursor: null,
  },
};

function createRequest(path = "/api/v1/audit") {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
    },
  });
}

describe("GET /api/v1/audit", () => {
  beforeEach(() => {
    mockResolveTenant.mockReset();
    mockRequireSupabaseUser.mockReset();
    mockUpsertAuthPrincipal.mockReset();
    mockRequireActiveMembership.mockReset();
    mockCan.mockReset();
    mockReadTenantAuditLog.mockReset();
    mockWithGlobalDb.mockClear();
    mockWithTenantTx.mockClear();

    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "018f0000-0000-7000-8000-000000000001",
      email: "admin@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue(principal);
    mockRequireActiveMembership.mockResolvedValue({
      membershipId: adminMembershipId,
      status: "ACTIVE",
    });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "audit.read",
      reason: "ALLOWED",
      matchedRoleKeys: ["admin"],
      bypassedResourcePredicate: true,
    });
    mockReadTenantAuditLog.mockResolvedValue(auditPayload);
  });

  it("lets owner/admin with audit.read list tenant audit logs", async () => {
    const response = await GET(createRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(auditPayload);
    expect(mockReadTenantAuditLog).toHaveBeenCalledTimes(1);
    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "audit.read",
        actor: expect.objectContaining({
          tenantId: tenantA.tenantId,
          membershipId: adminMembershipId,
        }),
      }),
    );
  });

  it("returns PERMISSION_DENIED for learner without audit.read", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "audit.read",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadTenantAuditLog).not.toHaveBeenCalled();
  });

  it("returns PERMISSION_DENIED for moderator without audit.read", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "audit.read",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });
    mockRequireActiveMembership.mockResolvedValue({
      membershipId: "018f0000-0000-7000-8000-000000000077",
      status: "ACTIVE",
    });

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockReadTenantAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["INVITED", membershipPending()],
    ["SUSPENDED", membershipSuspended()],
    ["REMOVED", membershipRemoved()],
  ] as const)("blocks %s membership before permission checks", async (_status, error) => {
    mockRequireActiveMembership.mockRejectedValue(error);

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe(error.code);
    expect(mockCan).not.toHaveBeenCalled();
    expect(mockReadTenantAuditLog).not.toHaveBeenCalled();
  });

  it("returns NO_MEMBERSHIP when the caller has no membership", async () => {
    mockRequireActiveMembership.mockRejectedValue(noMembership());

    const response = await GET(createRequest());
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("NO_MEMBERSHIP");
    expect(mockCan).not.toHaveBeenCalled();
    expect(mockReadTenantAuditLog).not.toHaveBeenCalled();
  });

  it("rejects client-supplied tenant_id query params", async () => {
    const response = await GET(createRequest("/api/v1/audit?tenant_id=tenant-b-id"));
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockWithTenantTx).not.toHaveBeenCalled();
  });

  it("returns a safe envelope without internal principal identifiers", async () => {
    const response = await GET(createRequest());
    const bodyText = await response.text();

    expect(bodyText).not.toContain(principal.id);
    expect(bodyText).not.toContain("authPrincipalId");
    expect(bodyText).not.toContain("auth_principal_id");
    expect(bodyText).not.toContain("entry_hash");

    const body = JSON.parse(bodyText) as {
      data: Array<Record<string, unknown>>;
      page: { hasMore: boolean; nextCursor: string | null };
    };

    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("page");
    expect(body.page).toEqual(
      expect.objectContaining({
        hasMore: expect.any(Boolean),
        nextCursor: null,
      }),
    );
  });

  it("supports cursor-based pagination", async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        occurredAt: "2025-01-01T00:00:00.000Z",
        id: "018f0000-0000-7000-8000-000000000001",
      }),
    ).toString("base64url");

    mockReadTenantAuditLog.mockResolvedValue({
      data: auditPayload.data,
      page: {
        hasMore: true,
        nextCursor: "next-page-cursor",
      },
    });

    const response = await GET(createRequest(`/api/v1/audit?cursor=${cursor}&limit=25`));
    const body = (await response.json()) as {
      page: { hasMore: boolean; nextCursor: string | null };
    };

    expect(response.status).toBe(200);
    expect(mockReadTenantAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cursor, limit: 25 }),
    );
    expect(body.page.hasMore).toBe(true);
    expect(body.page.nextCursor).toBe("next-page-cursor");
  });
});
