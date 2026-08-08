import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";

const tenantA = {
  tenantId: "018f0000-0000-7000-8000-000000000001",
  tenantSlug: "tenant-a",
  tenantState: "ACTIVE" as const,
};

const learnerMembershipId = "018f0000-0000-7000-8000-000000000020";
const courseId = "018f0000-0000-7000-8000-000000000030";

const {
  mockResolveTenant,
  mockRequireSupabaseUser,
  mockUpsertAuthPrincipal,
  mockRequireActiveMembership,
  mockCan,
  mockEnrollCurrentMemberInCourse,
  mockWithGlobalDb,
  mockWithTenantTx,
} = vi.hoisted(() => ({
  mockResolveTenant: vi.fn(),
  mockRequireSupabaseUser: vi.fn(),
  mockUpsertAuthPrincipal: vi.fn(),
  mockRequireActiveMembership: vi.fn(),
  mockCan: vi.fn(),
  mockEnrollCurrentMemberInCourse: vi.fn(),
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
  loadCourseForEnrollmentResourceRef: vi.fn(async () => ({
    type: "course",
    id: "018f0000-0000-7000-8000-000000000030",
    tenantId: "018f0000-0000-7000-8000-000000000001",
    tenantScoped: true,
    relationships: { publishedLearnerVisible: true },
  })),
}));

vi.mock("../../../backend/apps/api/src/server/enrollments/enrollments.service", () => ({
  enrollCurrentMemberInCourse: (...args: unknown[]) => mockEnrollCurrentMemberInCourse(...args),
}));

import { POST as createEnrollment } from "../../../backend/apps/api/src/app/api/v1/enrollments/route";

describe("POST /api/v1/enrollments", () => {
  beforeEach(() => {
    mockResolveTenant.mockResolvedValue(tenantA);
    mockRequireSupabaseUser.mockResolvedValue({
      supabaseUserId: "supabase-user",
      email: "learner@example.com",
      mfaEnabled: false,
    });
    mockUpsertAuthPrincipal.mockResolvedValue({ id: "principal-id" });
    mockRequireActiveMembership.mockResolvedValue({ membershipId: learnerMembershipId });
    mockCan.mockResolvedValue({
      allowed: true,
      permission: "enrollment.create",
      reason: "ALLOWED",
    });
    mockEnrollCurrentMemberInCourse.mockReset();
    mockEnrollCurrentMemberInCourse.mockResolvedValue({
      data: {
        id: "018f0000-0000-7000-8000-000000000050",
        courseId,
        status: "active",
        enrolledAt: new Date().toISOString(),
        created: true,
      },
    });
  });

  it("creates current-member enrollment", async () => {
    const response = await createEnrollment(
      new NextRequest("http://tenant-a.localhost/api/v1/enrollments", {
        method: "POST",
        body: JSON.stringify({ courseId }),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.courseId).toBe(courseId);
    expect(mockEnrollCurrentMemberInCourse).toHaveBeenCalledOnce();
  });

  it("rejects identity fields in body", async () => {
    const response = await createEnrollment(
      new NextRequest("http://tenant-a.localhost/api/v1/enrollments", {
        method: "POST",
        body: JSON.stringify({ courseId, membershipId: learnerMembershipId }),
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(mockEnrollCurrentMemberInCourse).not.toHaveBeenCalled();
  });

  it("returns safe denial for draft course enrollment", async () => {
    mockEnrollCurrentMemberInCourse.mockRejectedValueOnce(
      new AtlasHttpError({
        code: "PERMISSION_DENIED",
        status: 403,
        message: "You do not have access to enroll in this course.",
      }),
    );

    const response = await createEnrollment(
      new NextRequest("http://tenant-a.localhost/api/v1/enrollments", {
        method: "POST",
        body: JSON.stringify({ courseId }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
  });
});
