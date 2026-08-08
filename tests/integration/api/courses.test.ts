import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const learnerMembershipId = "018f0000-0000-7000-8000-000000000020";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockListPublishedCourses,
  mockGetPublishedCourseDetail,
  mockGetPublishedCourseModules,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockListPublishedCourses: vi.fn(),
  mockGetPublishedCourseDetail: vi.fn(),
  mockGetPublishedCourseModules: vi.fn(),
  mockWithGlobalDb: vi.fn((fn: (db: unknown) => unknown) => fn({ $queryRaw: vi.fn() })),
  mockWithTenantTx: vi.fn((_ctx: unknown, fn: (tx: unknown) => unknown) =>
    fn({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }),
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

vi.mock("../../../backend/apps/api/src/server/courses/load-course-resource-ref", () => ({
  loadCourseResourceRef: vi.fn(async () => ({
    type: "course",
    id: "018f0000-0000-7000-8000-000000000030",
    tenantId: "018f0000-0000-7000-8000-000000000001",
    tenantScoped: true,
    relationships: { publishedLearnerVisible: true },
  })),
  loadCourseCatalogResourceRef: vi.fn(async () => ({
    type: "course_catalog",
    id: "018f0000-0000-7000-8000-000000000001",
    tenantId: "018f0000-0000-7000-8000-000000000001",
    tenantScoped: true,
    relationships: { publishedLearnerVisible: true },
  })),
}));

vi.mock("../../../backend/apps/api/src/server/courses/courses.service", () => ({
  listPublishedCourses: (...args: unknown[]) => mockListPublishedCourses(...args),
  getPublishedCourseDetail: (...args: unknown[]) => mockGetPublishedCourseDetail(...args),
  getPublishedCourseModules: (...args: unknown[]) => mockGetPublishedCourseModules(...args),
}));

import { GET as listCourses } from "../../../backend/apps/api/src/app/api/v1/courses/route";
import { GET as getCourse } from "../../../backend/apps/api/src/app/api/v1/courses/[id]/route";
import { GET as getCourseModules } from "../../../backend/apps/api/src/app/api/v1/courses/[id]/modules/route";

const publishedCourseId = "018f0000-0000-7000-8000-000000000030";

describe("courses API integration", () => {
  beforeEach(() => {
    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "supabase-user",
      email: "learner@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue({ id: "principal-id" });
    mockRequireActiveMembership.mockResolvedValue({ membershipId: learnerMembershipId });
    mockCan.mockResolvedValue({ allowed: true, permission: "course.read", reason: "ALLOWED" });
    mockListPublishedCourses.mockResolvedValue({
      data: {
        items: [
          {
            id: publishedCourseId,
            slug: "published-course",
            title: "Published Course",
            description: "Visible",
            status: "PUBLISHED",
            accessTier: "FREE",
            priceCents: null,
            currency: null,
            locked: false,
            enrollmentStatus: "not_enrolled",
            updatedAt: new Date().toISOString(),
          },
        ],
        pageInfo: { nextCursor: null, hasNextPage: false },
      },
    });
    mockGetPublishedCourseDetail.mockResolvedValue({
      data: {
        id: publishedCourseId,
        slug: "published-course",
        title: "Published Course",
        description: "Visible",
        status: "PUBLISHED",
        accessTier: "FREE",
        priceCents: null,
        currency: null,
        locked: false,
        enrollmentStatus: "not_enrolled",
        enrolledAt: null,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
    mockGetPublishedCourseModules.mockResolvedValue({
      data: {
        items: [
          {
            id: "018f0000-0000-7000-8000-000000000040",
            title: "Module 1",
            position: 1,
            lessonCount: 2,
          },
        ],
      },
    });
  });

  it("GET /api/v1/courses returns published catalog envelope", async () => {
    const response = await listCourses(new NextRequest("http://tenant-a.localhost/api/v1/courses"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].status).toBe("PUBLISHED");
    expect(mockListPublishedCourses).toHaveBeenCalledOnce();
  });

  it("GET /api/v1/courses/:id returns published detail", async () => {
    const response = await getCourse(
      new NextRequest(`http://tenant-a.localhost/api/v1/courses/${publishedCourseId}`),
      { params: Promise.resolve({ id: publishedCourseId }) },
    );

    expect(response.status).toBe(200);
    expect(mockGetPublishedCourseDetail).toHaveBeenCalledOnce();
  });

  it("GET /api/v1/courses/:id/modules returns outline only", async () => {
    const response = await getCourseModules(
      new NextRequest(`http://tenant-a.localhost/api/v1/courses/${publishedCourseId}/modules`),
      { params: Promise.resolve({ id: publishedCourseId }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items[0]).toEqual({
      id: "018f0000-0000-7000-8000-000000000040",
      title: "Module 1",
      position: 1,
      lessonCount: 2,
    });
    expect(body.data.items[0]).not.toHaveProperty("content");
    expect(body.data.items[0]).not.toHaveProperty("assets");
  });
});
