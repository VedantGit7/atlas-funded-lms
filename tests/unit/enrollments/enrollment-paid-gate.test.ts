import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasHttpError } from "@atlas/core/http/errors";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const actorMembershipId = "018f0000-0000-7000-8000-000000000020";
const courseId = "018f0000-0000-7000-8000-000000000030";

const { mockFindCourseAuthProjection, mockFindActiveEnrollment, mockInsertEnrollment } = vi.hoisted(
  () => ({
    mockFindCourseAuthProjection: vi.fn(),
    mockFindActiveEnrollment: vi.fn(),
    mockInsertEnrollment: vi.fn(),
  }),
);

// Keep the real readCoursePricing so the gate exercises actual projection logic.
vi.mock("../../../backend/apps/api/src/server/courses/courses.repository", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    findCourseAuthProjection: (...args: unknown[]) => mockFindCourseAuthProjection(...args),
  };
});

vi.mock("../../../backend/apps/api/src/server/enrollments/enrollments.repository", () => ({
  findActiveEnrollment: (...args: unknown[]) => mockFindActiveEnrollment(...args),
  insertEnrollment: (...args: unknown[]) => mockInsertEnrollment(...args),
  publishEnrollmentCreatedEvent: vi.fn(async () => undefined),
  cancelEnrollment: vi.fn(),
  findEnrollmentById: vi.fn(),
  listEnrollmentsForCourse: vi.fn(),
  listEnrollmentsForMember: vi.fn(),
}));

import { enrollCurrentMemberInCourse } from "../../../backend/apps/api/src/server/enrollments/enrollments.service";

const ctx = { tenantId, actorMembershipId, requestId: "req-1" };
const tx = {} as never;

function courseProjection(metadataJson: Record<string, unknown> | null) {
  return {
    id: courseId,
    tenantId,
    slug: "course",
    title: "Course",
    description: null,
    status: "PUBLISHED",
    metadataJson,
    createdByMembershipId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("enrollCurrentMemberInCourse freemium gate", () => {
  beforeEach(() => {
    mockFindCourseAuthProjection.mockReset();
    mockFindActiveEnrollment.mockReset();
    mockInsertEnrollment.mockReset();
    mockFindActiveEnrollment.mockResolvedValue(null);
    mockInsertEnrollment.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      enrolledAt: new Date(),
      created: true,
    });
  });

  it("enrolls a learner in a FREE course", async () => {
    mockFindCourseAuthProjection.mockResolvedValue(courseProjection({ accessTier: "FREE" }));

    const result = await enrollCurrentMemberInCourse(tx, ctx, { courseId });

    expect(result.data.status).toBe("active");
    expect(result.data.created).toBe(true);
    expect(mockInsertEnrollment).toHaveBeenCalledOnce();
  });

  it("treats courses without a tier as FREE", async () => {
    mockFindCourseAuthProjection.mockResolvedValue(courseProjection(null));

    const result = await enrollCurrentMemberInCourse(tx, ctx, { courseId });

    expect(result.data.created).toBe(true);
    expect(mockInsertEnrollment).toHaveBeenCalledOnce();
  });

  it("rejects a new enrollment in a PAID course with PAYMENT_REQUIRED", async () => {
    mockFindCourseAuthProjection.mockResolvedValue(
      courseProjection({ accessTier: "PAID", priceCents: 5000, currency: "USD" }),
    );

    await expect(enrollCurrentMemberInCourse(tx, ctx, { courseId })).rejects.toMatchObject({
      code: "PAYMENT_REQUIRED",
      status: 402,
    });
    await expect(
      enrollCurrentMemberInCourse(tx, ctx, { courseId }),
    ).rejects.toBeInstanceOf(AtlasHttpError);
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
  });

  it("keeps access for an already-enrolled learner on a PAID course", async () => {
    mockFindCourseAuthProjection.mockResolvedValue(
      courseProjection({ accessTier: "PAID", priceCents: 5000, currency: "USD" }),
    );
    mockFindActiveEnrollment.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      status: "active",
      enrolledAt: new Date(),
    });

    const result = await enrollCurrentMemberInCourse(tx, ctx, { courseId });

    expect(result.data.created).toBe(false);
    expect(result.data.status).toBe("active");
    expect(mockInsertEnrollment).not.toHaveBeenCalled();
  });
});
