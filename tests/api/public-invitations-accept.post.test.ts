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
  mockRequireSessionUser,
  mockResolveSessionPrincipal,
  mockAcceptInvitation,
  mockReadMembershipRoleKeys,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockRejectClientTenantId,
  mockRecordAcceptance,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSessionUser: vi.fn(),
  mockResolveSessionPrincipal: vi.fn(),
  mockAcceptInvitation: vi.fn(),
  mockReadMembershipRoleKeys: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn() }),
  ),
  mockRejectClientTenantId: vi.fn(),
  mockRecordAcceptance: vi.fn(),
}));

vi.mock("@atlas/tenancy", () => ({
  // Nothing is cached in these tests, so tenant routes ask resolveTenantFromRequest.
  resolveTenantFromRecentLookup: () => null,
  resolveTenantFromRequest: (...args: unknown[]) => mockResolveTenant(...args),
}));

vi.mock("@atlas/api/session-user", () => ({
  requireSessionUser: (...args: unknown[]) => mockRequireSessionUser(...args),
  resolveSessionPrincipal: (...args: unknown[]) => mockResolveSessionPrincipal(...args),
}));

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

vi.mock(
  "../../backend/apps/api/src/server/tenant-settings/legal-acceptance.service",
  async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    recordLegalAcceptance: (...args: unknown[]) => mockRecordAcceptance(...args),
  }),
);

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
    mockRequireSessionUser.mockResolvedValue({
      principalId: "principal-id",
      email: "invitee@example.com",
      mfaEnabled: false,
    });
    mockResolveSessionPrincipal.mockResolvedValue({
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
    const response = await POST(createRequest({ token: `${"a".repeat(40)}`, acceptTerms: true }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: { status: "ACCEPTED", redirectTo: "/" },
    });
    // Launch plan 5.7: the agreement is recorded with the membership it opens.
    expect(mockRecordAcceptance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        membershipId: "membership-a",
        consent: expect.objectContaining({ source: "invitation" }),
      }),
    );
  });

  it("refuses to accept without the agreement box ticked, opening nothing", async () => {
    const response = await POST(createRequest({ token: `${"a".repeat(40)}` }));

    expect(response.status).toBe(400);
    expect(mockAcceptInvitation).not.toHaveBeenCalled();
    expect(mockRecordAcceptance).not.toHaveBeenCalled();
  });
});
