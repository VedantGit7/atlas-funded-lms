import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasHttpError } from "@atlas/core/http/errors";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const actorMembershipId = "018f0000-0000-7000-8000-000000000020";
const otherMembershipId = "018f0000-0000-7000-8000-000000000021";
const courseId = "018f0000-0000-7000-8000-000000000030";

const {
  mockFindCourseAuthProjection,
  mockFindEnrollment,
  mockUpsert,
  mockPublish,
  mockAggregate,
  mockFindMine,
  mockList,
} = vi.hoisted(() => ({
  mockFindCourseAuthProjection: vi.fn(),
  mockFindEnrollment: vi.fn(),
  mockUpsert: vi.fn(),
  mockPublish: vi.fn(),
  mockAggregate: vi.fn(),
  mockFindMine: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock(
  "../../../backend/apps/api/src/server/courses/courses.repository",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      findCourseAuthProjection: (...args: unknown[]) => mockFindCourseAuthProjection(...args),
      findEnrollmentForMembership: (...args: unknown[]) => mockFindEnrollment(...args),
    };
  },
);

vi.mock("../../../backend/apps/api/src/server/reviews/reviews.repository", () => ({
  upsertCourseReview: (...args: unknown[]) => mockUpsert(...args),
  publishCourseReviewCreatedEvent: (...args: unknown[]) => mockPublish(...args),
  getCourseReviewAggregate: (...args: unknown[]) => mockAggregate(...args),
  findMyCourseReview: (...args: unknown[]) => mockFindMine(...args),
  listCourseReviews: (...args: unknown[]) => mockList(...args),
}));

import {
  getCourseReviews,
  submitCourseReview,
} from "../../../backend/apps/api/src/server/reviews/reviews.service";

const ctx = { tenantId, actorMembershipId, requestId: "req-1" };
const tx = {} as never;

function courseProjection(status = "PUBLISHED") {
  return {
    id: courseId,
    tenantId,
    slug: "course",
    title: "Course",
    description: null,
    status,
    metadataJson: null,
    createdByMembershipId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("submitCourseReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindCourseAuthProjection.mockResolvedValue(courseProjection());
    mockFindEnrollment.mockResolvedValue({ id: "e1", status: "active", enrolledAt: new Date() });
    mockUpsert.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      createdAt: new Date("2026-07-14T00:00:00Z"),
      updatedAt: new Date("2026-07-14T00:00:00Z"),
      created: true,
    });
    mockPublish.mockResolvedValue(undefined);
  });

  it("stores a review for an enrolled learner and emits an event on creation", async () => {
    const result = await submitCourseReview(tx, ctx, courseId, {
      rating: 5,
      comment: "Great course",
    });

    expect(result.data.rating).toBe(5);
    expect(result.data.comment).toBe("Great course");
    expect(result.data.created).toBe(true);
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockPublish).toHaveBeenCalledOnce();
  });

  it("does not emit an event when updating an existing review", async () => {
    mockUpsert.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      createdAt: new Date(),
      updatedAt: new Date(),
      created: false,
    });

    const result = await submitCourseReview(tx, ctx, courseId, { rating: 4 });

    expect(result.data.created).toBe(false);
    expect(result.data.comment).toBeNull();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("rejects a review from a learner who is not enrolled", async () => {
    mockFindEnrollment.mockResolvedValue(null);

    await expect(submitCourseReview(tx, ctx, courseId, { rating: 5 })).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403,
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects a review on a non-published course", async () => {
    mockFindCourseAuthProjection.mockResolvedValue(courseProjection("DRAFT"));

    await expect(submitCourseReview(tx, ctx, courseId, { rating: 5 })).rejects.toBeInstanceOf(
      AtlasHttpError,
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("getCourseReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindCourseAuthProjection.mockResolvedValue(courseProjection());
    mockAggregate.mockResolvedValue({ average: 4.5, count: 2 });
    mockFindMine.mockResolvedValue(null);
    mockList.mockResolvedValue({
      items: [
        {
          id: "r1",
          rating: 5,
          comment: "Loved it",
          authorName: "Priya Nair",
          membershipId: actorMembershipId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "r2",
          rating: 4,
          comment: null,
          authorName: "Diego Fuentes",
          membershipId: otherMembershipId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      pageInfo: { nextCursor: null, hasNextPage: false },
    });
  });

  it("returns the aggregate and flags the viewer's own review", async () => {
    const result = await getCourseReviews(tx, ctx, courseId, { limit: 10 });

    expect(result.data.aggregate).toEqual({ average: 4.5, count: 2 });
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0]?.mine).toBe(true);
    expect(result.data.items[1]?.mine).toBe(false);
  });
});
