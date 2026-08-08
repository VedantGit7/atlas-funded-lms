"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { enrollmentListResponseSchema } from "@atlas/contracts/enrollments/schemas";
import type { enrollmentCancelResponseSchema } from "@atlas/contracts/enrollments/schemas";
import type { courseProgressListResponseSchema } from "@atlas/contracts/courses/course-progress.schemas";
import type { myCompetencyResponseSchema } from "@atlas/contracts/competency/competency-projection.schemas";
import type { gradingListResponseSchema, gradingTaskDetailResponseSchema } from "@atlas/contracts/grading/grading-schemas";
import type { attemptRunnerResponseSchema } from "@atlas/contracts/assessments/assessment-response-schemas";
import type { certificateTemplateListResponseSchema, certificateDetailResponseSchema } from "@atlas/contracts/certificates/certificate.dto";

type EnrollmentListResponse = z.infer<typeof enrollmentListResponseSchema>;
type EnrollmentCancelResponse = z.infer<typeof enrollmentCancelResponseSchema>;
type CourseProgressListResponse = z.infer<typeof courseProgressListResponseSchema>;
type MemberCompetencyResponse = z.infer<typeof myCompetencyResponseSchema>;
type GradingListResponse = z.infer<typeof gradingListResponseSchema>;
type GradingTaskDetailResponse = z.infer<typeof gradingTaskDetailResponseSchema>;
type AttemptDetailResponse = z.infer<typeof attemptRunnerResponseSchema>;
type CertificateTemplateListResponse = z.infer<typeof certificateTemplateListResponseSchema>;
type CertificateDetailResponse = z.infer<typeof certificateDetailResponseSchema>;

export type CourseLearnerRow = {
  enrollmentId: string;
  membershipId: string;
  displayName: string;
  enrolledAt: string;
  progressPct: number;
  completedLessons: number;
  totalLessons: number;
};

export type GradingTaskSummary = GradingListResponse["data"][number];

export type LearnerAttemptSummary = {
  attemptId: string;
  assessmentTitle: string;
  status: AttemptDetailResponse["data"]["status"];
  submittedAt: string | null;
  scorePercent: number | null;
  passed: boolean | null;
  gradingTaskId: string | null;
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
      enrollmentId: enrollment.id,
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

export async function fetchLearnerGradingTasks(
  membershipId: string,
): Promise<GradingTaskSummary[]> {
  const response = await clientApi.get<GradingListResponse>(
    `/api/v1/grading-tasks?assignedTo=all&learnerMembershipId=${membershipId}&limit=25`,
  );
  return response.data;
}

export async function fetchAttemptDetail(attemptId: string): Promise<AttemptDetailResponse["data"]> {
  const response = await clientApi.get<AttemptDetailResponse>(`/api/v1/attempts/${attemptId}`);
  return response.data;
}

export async function fetchLearnerAttemptSummaries(
  membershipId: string,
): Promise<LearnerAttemptSummary[]> {
  const tasks = await fetchLearnerGradingTasks(membershipId);
  if (tasks.length === 0) {
    return [];
  }

  const details = await Promise.all(
    tasks.map(async (task) => {
      const detail = await clientApi.get<GradingTaskDetailResponse>(
        `/api/v1/grading-tasks/${task.id}`,
      );
      return { task, detail: detail.data };
    }),
  );

  const attempts = await Promise.all(
    details.map(async ({ task, detail }) => {
      const attempt = await fetchAttemptDetail(detail.attempt.id);
      return {
        attemptId: attempt.id,
        assessmentTitle: task.assessmentTitle,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        scorePercent: attempt.scorePercent ?? null,
        passed: attempt.passed ?? null,
        gradingTaskId: task.id,
      } satisfies LearnerAttemptSummary;
    }),
  );

  return attempts;
}

export async function cancelEnrollment(enrollmentId: string): Promise<EnrollmentCancelResponse> {
  return clientApi.delete(`/api/v1/enrollments/${enrollmentId}`, `cancel-enrollment-${enrollmentId}`);
}

export async function fetchPublishedCertificateTemplates(): Promise<
  Array<{ id: string; name: string }>
> {
  const response = await clientApi.get<CertificateTemplateListResponse>(
    "/api/v1/certificate-templates",
  );
  return response.data
    .filter((template) => template.status === "PUBLISHED")
    .map((template) => ({ id: template.id, name: template.name }));
}

export async function issueCourseCertificate(input: {
  courseId: string;
  recipientMembershipId: string;
  templateId: string;
}): Promise<CertificateDetailResponse> {
  return clientApi.post<CertificateDetailResponse>(
    "/api/v1/certificates/issue",
    {
      templateId: input.templateId,
      recipientMembershipId: input.recipientMembershipId,
      source: { type: "course", id: input.courseId },
    },
    `issue-cert-${input.recipientMembershipId}`,
  );
}
