import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level coverage for the product detail and enrolment-roster endpoints.
 *
 * Both services existed with no route in front of them. These call the exported
 * handlers the way Next.js does, so the permission gate, the params schema and
 * the response envelope are all exercised; only the repository is stubbed.
 *
 * The gate is the point worth pinning: reading the catalogue is `course.read`,
 * but reading which named learners are enrolled is `enrollment.read`, and those
 * are different disclosures.
 */

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const adminMembershipId = "018f0000-0000-7000-8000-000000000010";
const bundleId = "018f0000-0000-7000-8000-0000000000b1";
const courseId = "018f0000-0000-7000-8000-0000000000c1";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockWithGlobalDb,
  mockWithTenantTx,
  mockFindBundleById,
  mockResolveItemTitles,
  mockListProductEnrollments,
  mockCountProductEnrollments,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({
      $queryRaw: vi.fn().mockResolvedValue([]),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    }),
  ),
  mockFindBundleById: vi.fn(),
  mockResolveItemTitles: vi.fn(),
  mockListProductEnrollments: vi.fn(),
  mockCountProductEnrollments: vi.fn(),
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
    enforceEntitlement: vi.fn(),
  };
});

vi.mock("@atlas/audit", () => ({
  auditWriter: { write: vi.fn() },
}));

vi.mock(
  "../../backend/packages/domain/src/learner-products/learner-products.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      learnerProductsRepository: {
        findBundleById: (...args: unknown[]) => mockFindBundleById(...args),
        resolveItemTitles: (...args: unknown[]) => mockResolveItemTitles(...args),
        listProductEnrollments: (...args: unknown[]) => mockListProductEnrollments(...args),
        countProductEnrollments: (...args: unknown[]) => mockCountProductEnrollments(...args),
      },
    };
  },
);

const { GET: GET_DETAIL } =
  await import("../../backend/apps/api/src/app/api/v1/bundles/[bundleId]/route");
const { GET: GET_ROSTER } =
  await import("../../backend/apps/api/src/app/api/v1/bundles/[bundleId]/enrollments/route");

function request(path: string) {
  return new NextRequest(`https://tenant-a.example.com${path}`, {
    headers: { host: "tenant-a.example.com", authorization: "Bearer access-token" },
  });
}

function routeContext(id: string = bundleId) {
  return { params: Promise.resolve({ bundleId: id }) };
}

function bundleFixture() {
  return {
    bundle: {
      id: bundleId,
      tenant_id: tenantA.tenantId,
      slug: "complete-trader-bundle",
      title: "Complete trader bundle",
      description: "A comprehensive path.",
      status: "DRAFT",
      created_at: new Date("2026-08-01T00:00:00.000Z"),
      updated_at: new Date("2026-08-20T00:00:00.000Z"),
    },
    items: [
      {
        id: "018f0000-0000-7000-8000-0000000000d1",
        bundle_id: bundleId,
        item_kind: "course",
        ref_id: courseId,
        position: 0,
      },
      {
        id: "018f0000-0000-7000-8000-0000000000d2",
        bundle_id: bundleId,
        item_kind: "course",
        ref_id: "018f0000-0000-7000-8000-0000000000c2",
        position: 1,
      },
    ],
  };
}

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

describe("GET /api/v1/bundles/[bundleId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin("course.read");
    mockFindBundleById.mockResolvedValue(bundleFixture());
    mockResolveItemTitles.mockResolvedValue(
      new Map([[`course:${courseId}`, "Market Fundamentals"]]),
    );
  });

  it("returns the product with each item title resolved", async () => {
    const response = await GET_DETAIL(request(`/api/v1/bundles/${bundleId}`), routeContext());
    const body = (await response.json()) as {
      data: { title: string; items: Array<{ refId: string; title: string | null }> };
    };

    expect(response.status).toBe(200);
    expect(body.data.title).toBe("Complete trader bundle");
    expect(body.data.items[0]).toMatchObject({ refId: courseId, title: "Market Fundamentals" });
    // The second item points at a course that no longer resolves.
    expect(body.data.items[1]?.title).toBeNull();
  });

  it("resolves every item in one batched call", async () => {
    await GET_DETAIL(request(`/api/v1/bundles/${bundleId}`), routeContext());

    expect(mockResolveItemTitles).toHaveBeenCalledTimes(1);
    expect(mockResolveItemTitles).toHaveBeenCalledWith(expect.anything(), [
      { kind: "course", refId: courseId },
      { kind: "course", refId: "018f0000-0000-7000-8000-0000000000c2" },
    ]);
  });

  it("gates the product read on course.read", async () => {
    await GET_DETAIL(request(`/api/v1/bundles/${bundleId}`), routeContext());

    expect(mockCan).toHaveBeenCalledWith(expect.objectContaining({ permission: "course.read" }));
  });

  it("404s a bundle this tenant cannot see", async () => {
    mockFindBundleById.mockResolvedValue(null);

    const response = await GET_DETAIL(request(`/api/v1/bundles/${bundleId}`), routeContext());

    expect(response.status).toBe(404);
  });

  it("rejects a product id that is not a uuid", async () => {
    const response = await GET_DETAIL(
      request("/api/v1/bundles/not-a-uuid"),
      routeContext("not-a-uuid"),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockFindBundleById).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/bundles/[bundleId]/enrollments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthenticatedAdmin("enrollment.read");
    mockFindBundleById.mockResolvedValue(bundleFixture());
    mockCountProductEnrollments.mockResolvedValue(1);
    mockListProductEnrollments.mockResolvedValue({
      totalCount: 1,
      items: [
        {
          id: "018f0000-0000-7000-8000-0000000000e1",
          membership_id: "018f0000-0000-7000-8000-0000000000f1",
          display_name: "Priya Raghunathan",
          email: "priya@example.com",
          status: "active",
          enrolled_type: "comp",
          enrolled_at: new Date("2026-08-20T10:00:00.000Z"),
          expires_at: null,
          completed_at: null,
        },
      ],
    });
  });

  it("returns the roster with learner names attached", async () => {
    const response = await GET_ROSTER(
      request(`/api/v1/bundles/${bundleId}/enrollments`),
      routeContext(),
    );
    const body = (await response.json()) as {
      data: {
        items: Array<{ displayName: string | null; email: string | null; enrolledType: string }>;
        pageInfo: { totalCount: number };
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.pageInfo.totalCount).toBe(1);
    expect(body.data.items[0]).toMatchObject({
      displayName: "Priya Raghunathan",
      email: "priya@example.com",
      enrolledType: "comp",
    });
  });

  it("gates the roster on enrollment.read, not course.read", async () => {
    await GET_ROSTER(request(`/api/v1/bundles/${bundleId}/enrollments`), routeContext());

    expect(mockCan).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "enrollment.read" }),
    );
  });

  it("refuses a member without enrollment.read", async () => {
    mockCan.mockResolvedValue({
      allowed: false,
      permission: "enrollment.read",
      reason: "NO_ROLE_GRANT",
      safeMessage: "You do not have access to perform this action.",
    });

    const response = await GET_ROSTER(
      request(`/api/v1/bundles/${bundleId}/enrollments`),
      routeContext(),
    );
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PERMISSION_DENIED");
    expect(mockListProductEnrollments).not.toHaveBeenCalled();
  });

  it("404s the roster of a bundle this tenant cannot see", async () => {
    mockFindBundleById.mockResolvedValue(null);

    const response = await GET_ROSTER(
      request(`/api/v1/bundles/${bundleId}/enrollments`),
      routeContext(),
    );

    expect(response.status).toBe(404);
    expect(mockListProductEnrollments).not.toHaveBeenCalled();
  });
});
