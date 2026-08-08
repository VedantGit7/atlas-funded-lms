import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
  requestId: "req-invite",
  host: "tenant-a.example.com",
  tenantDomainId: "domain-a",
  tenantDomainStatus: "ACTIVE" as const,
};

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockAcceptInvitation,
  mockReadMembershipRoleKeys,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockRejectClientTenantId,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockAcceptInvitation: vi.fn(),
  mockReadMembershipRoleKeys: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn() }),
  ),
  mockRejectClientTenantId: vi.fn(),
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
    acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
  };
});

vi.mock("@atlas/domain-identity", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    rejectClientTenantId: (...args: unknown[]) => mockRejectClientTenantId(...args),
    readMembershipRoleKeys: (...args: unknown[]) => mockReadMembershipRoleKeys(...args),
    resolveRoleHomePath: () => "/",
  };
});

vi.mock("@atlas/db/global-db", () => ({
  withGlobalDb: (fn: (db: unknown) => unknown) => mockWithGlobalDb(fn),
}));

vi.mock("@atlas/db/with-tenant-tx", () => ({
  withTenantTx: (ctx: unknown, fn: (tx: unknown) => unknown) => mockWithTenantTx(ctx, fn),
}));

import { POST } from "../../backend/apps/api/src/app/api/v1/public/invitations/accept/route";

function createRequest(body: object) {
  return new NextRequest("https://tenant-a.example.com/api/v1/public/invitations/accept", {
    method: "POST",
    headers: {
      host: "tenant-a.example.com",
      authorization: "Bearer access-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/public/invitations/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "supabase-user",
      email: "invitee@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue({
      id: "principal-a",
      emailNormalized: "invitee@example.com",
    });
    mockAcceptInvitation.mockResolvedValue({
      membership: { id: "membership-a", status: "ACTIVE" },
      profile: { id: "profile-a", displayName: null, avatarUrl: null },
    });
    mockReadMembershipRoleKeys.mockResolvedValue(["learner"]);
  });

  it("accepts invitation and returns accepted status", async () => {
    const response = await POST(createRequest({ token: `${"a".repeat(40)}` }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: { status: "ACCEPTED", redirectTo: "/" },
    });
  });
});
