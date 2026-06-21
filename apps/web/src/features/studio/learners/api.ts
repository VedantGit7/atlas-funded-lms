"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { enrollmentListResponseSchema } from "../../../server/enrollments/schemas";
import type { courseProgressListResponseSchema } from "../../../server/courses/course-progress.schemas";
import type { myCompetencyResponseSchema } from "../../../server/competency/competency-projection.schemas";

type EnrollmentListResponse = z.infer<typeof enrollmentListResponseSchema>;
type CourseProgressListResponse = z.infer<typeof courseProgressListResponseSchema>;
type MemberCompetencyResponse = z.infer<typeof myCompetencyResponseSchema>;

export type CourseLearnerRow = {
  membershipId: string;
  displayName: string;
  enrolledAt: string;
  progressPct: number;
  completedLessons: number;
  totalLessons: number;
};

export function formatStudioLearnerApiError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.requestId ? `${error.message} Request ID: ${error.requestId}` : error.message;
  }
  return "Request failed.";
}

export async function fetchCourseLearnerRoster(courseId: string): Promise<CourseLearnerRow[]> {
  const [enrollments, progress] = await Promise.all([
    clientApi.get<EnrollmentListResponse>(`/api/v1/enrollments?courseId=${courseId}&limit=100`),
    clientApi.get<CourseProgressListResponse>(`/api/v1/courses/${courseId}/progress?limit=100`),
  ]);

  const progressByMember = new Map(progress.data.items.map((item) => [item.membershipId, item]));

  return enrollments.data.items.map((enrollment) => {
    const progressRow = progressByMember.get(enrollment.membershipId);
    return {
      membershipId: enrollment.membershipId,
      displayName: enrollment.displayName?.trim() || "Learner",
      enrolledAt: enrollment.enrolledAt,
      progressPct: progressRow?.progressPct ?? 0,
      completedLessons: progressRow?.completedLessons ?? 0,
      totalLessons: progressRow?.totalLessons ?? 0,
    };
  });
}

export async function fetchMemberCompetencySnapshot(
  membershipId: string,
): Promise<MemberCompetencyResponse> {
  return clientApi.get<MemberCompetencyResponse>(`/api/v1/members/${membershipId}/competency`);
}
