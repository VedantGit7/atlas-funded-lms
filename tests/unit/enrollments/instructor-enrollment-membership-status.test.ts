import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtlasHttpError } from "@atlas/core/http/errors";

const tenantId = "018f0000-0000-7000-8000-000000000001";
const actorMembershipId = "018f0000-0000-7000-8000-000000000020";
const courseId = "018f0000-0000-7000-8000-000000000030";
const targetMembershipId = "018f0000-0000-7000-8000-000000000040";

const {
  mockFindCourseAuthProjection,
  mockFindMembershipById,
  mockFindActiveEnrollment,
  mockInsertEnrollment,
} = vi.hoisted(() => ({
  mockFindCourseAuthProjection: vi.fn(),
  mockFindMembershipById: vi.fn(),
  mockFindActiveEnrollment: vi.fn(),
  mockInsertEnrollment: vi.fn(),
}));

vi.mock("../../../backend/apps/api/src/server/courses/courses.repository", () => ({
  findCourseAuthProjection: (...args: unknown[]) => mockFindCourseAuthProjection(...args),
}));

vi.mock("@atlas/membership/member-admin.repository", () => ({
  findMembershipById: (...args: unknown[]) => mockFindMembershipById(...args),
}));

vi.mock("../../../backend/apps/api/src/server/enrollments/enrollments.repository", () => ({
  findActiveEnrollment: (...args: unknown[]) => mockFindActiveEnrollment(...args),
  insertEnrollment: (...args: unknown[]) => mockInsertEnrollment(...args),
  publishEnrollmentCreatedEvent: vi.fn(async () => undefined),
}));

import { enrollMemberInCourseByInstructor } from "../../../backend/apps/api/src/server/enrollments/enrollments.service";

const ctx = { tenantId, actorMembershipId, requestId: "req-1" };
const tx = {} as never;

describe("enrollMemberInCourseByInstructor membership status", () => {
  beforeEach(() => {
    mockFindCourseAuthProjection.mockReset();
    mockFindMembershipById.mockReset();
    mockFindActiveEnrollment.mockReset();
    mockInsertEnrollment.mockReset();

    mockFindCourseAuthProjection.mockResolvedValue({
      id: courseId,
      tenantId,
      status: "DRAFT",
    });
    mockFindActiveEnrollment.mockResolvedValue(null);
    mockInsertEnrollment.mockResolvedValue({
      id: "018f0000-0000-7000-8000-000000000050",
      enrolledAt: new Date(),
      created: true,
    });
  });

  it("enrolls an invited member created from the studio picker", async () => {
    mockFindMembershipById.mockResolvedValue({
      id: targetMembershipId,
      status: "INVITED",
    });

    const result = await enrollMemberInCourseByInstructor(tx, ctx, courseId, {
      membershipId: targetMembershipId,
    });

    expect(result.data.created).toBe(true);
    expect(mockInsertEnrollment).toHaveBeenCalledOnce();
  });

  it("rejects suspended members", async () => {
    mockFindMembershipById.mockResolvedValue({
      id: targetMembershipId,
      status: "SUSPENDED",
    });

    await expect(
      enrollMemberInCourseByInstructor(tx, ctx, courseId, {
        membershipId: targetMembershipId,
      }),
    ).rejects.toBeInstanceOf(AtlasHttpError);
  });
});
