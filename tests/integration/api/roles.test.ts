import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createRoleBodySchema } from "@atlas/domain-access/schemas/access-admin";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockListRoles,
  mockCreateRole,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockListRoles: vi.fn(),
  mockCreateRole: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      // Model a successful claim only for its INSERT. No claim must still fail
      // closed in the real idempotency implementation before the handler runs.
      $queryRaw: vi.fn((query: TemplateStringsArray) =>
        Promise.resolve(
          /INSERT INTO idempotency_records/i.test(query.join(" "))
            ? [{ id: "018f0000-0000-7000-8000-000000000030" }]
            : [],
        ),
      ),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
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

vi.mock("@atlas/domain-access", () => ({
  listRoles: (...args: unknown[]) => mockListRoles(...args),
  createRole: (...args: unknown[]) => mockCreateRole(...args),
}));

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

import { GET, POST } from "../../../backend/apps/api/src/app/api/v1/roles/route";

describe("roles API", () => {
  beforeEach(() => {
    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "supabase-user",
      email: "admin@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue({ id: "principal-id" });
    mockRequireActiveMembership.mockResolvedValue({ membershipId: adminMembershipId });
    mockCan.mockResolvedValue({ allowed: true, permission: "role.read", reason: "ALLOWED" });
    mockListRoles.mockResolvedValue({
      data: {
        items: [],
        pageInfo: { nextCursor: null, hasNextPage: false },
      },
    });
    mockCreateRole.mockResolvedValue({
      data: {
        id: "018f0000-0000-7000-8000-000000000020",
        key: "support",
        name: "Support",
        isSystem: false,
        permissions: ["profile.read"],
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    });
  });

  it("lists roles with envelope", async () => {
    const response = await GET(new NextRequest("http://tenant-a.localhost/api/v1/roles"));
    expect(response.status).toBe(200);
    expect(mockListRoles).toHaveBeenCalledOnce();
  });

  it("rejects platform permissions in create body schema", () => {
    expect(() =>
      createRoleBodySchema.parse({
        key: "bad",
        name: "Bad",
        permissions: ["platform.tenant.read"],
      }),
    ).toThrow();
  });

  it("creates role through route handler", async () => {
    mockCan.mockResolvedValue({ allowed: true, permission: "role.create", reason: "ALLOWED" });

    const response = await POST(
      new NextRequest("http://tenant-a.localhost/api/v1/roles", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "role-create-test",
        },
        body: JSON.stringify({
          key: "support",
          name: "Support",
          permissions: ["profile.read"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockCreateRole).toHaveBeenCalledOnce();
  });
});
