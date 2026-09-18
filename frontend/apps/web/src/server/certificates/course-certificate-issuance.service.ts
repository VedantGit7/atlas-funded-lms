// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { issueCertificate } from "./certificate.service";
import {
  evaluateCourseCertificateEligibility,
  parseCourseCertificateSettings,
} from "./course-certificate-eligibility";
import { courseCertificateIssuanceRepository } from "./course-certificate-issuance.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

const SYSTEM_ACTOR_MEMBERSHIP_ID = "00000000-0000-0000-0000-000000000000";

export type CourseCertificateIssuanceOutcome =
  | { status: "issued"; certificateId: string }
  | { status: "skipped"; reason: string }
  | { status: "already_issued"; certificateId: string };

async function resolveCourseIdFromEvent(args: {
  tx: TenantTx;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<string | null> {
  if (args.eventType === "lesson.completed" && typeof args.payload["courseId"] === "string") {
    return args.payload["courseId"];
  }

  if (typeof args.payload["courseId"] === "string") {
    return args.payload["courseId"];
  }

  if (args.eventType === "lesson.completed" && typeof args.payload["lessonId"] === "string") {
    return courseCertificateIssuanceRepository.findCourseIdForLesson(
      args.tx,
      args.payload["lessonId"],
    );
  }

  if (
    (args.eventType === "assessment.submitted" || args.eventType === "assessment.graded") &&
    typeof args.payload["assessmentId"] === "string"
  ) {
    return courseCertificateIssuanceRepository.findCourseIdForAssessment(
      args.tx,
      args.payload["assessmentId"],
    );
  }

  return null;
}

function resolveMembershipId(eventType: string, payload: Record<string, unknown>): string | null {
  if (eventType === "assessment.graded") {
    return typeof payload["learnerMembershipId"] === "string"
      ? payload["learnerMembershipId"]
      : null;
  }
  return typeof payload["membershipId"] === "string" ? payload["membershipId"] : null;
}

/**
 * Evaluates studio certificate rules for a learner on a course and issues
 * when eligible. Idempotent per membership + course source.
 */
export async function maybeIssueCourseCertificate(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    courseId: string;
    membershipId: string;
    sourceEventId: string;
  },
): Promise<CourseCertificateIssuanceOutcome> {
  const course = await courseCertificateIssuanceRepository.findCourseContext(tx, args.courseId);
  if (!course) {
    return { status: "skipped", reason: "COURSE_NOT_FOUND" };
  }

  const settings = parseCourseCertificateSettings(course.tags);
  if (!settings.enabled) {
    return { status: "skipped", reason: "CERTIFICATES_DISABLED" };
  }

  const existing = await courseCertificateIssuanceRepository.findIssuedCertificateForCourse({
    tx,
    tenantId: ctx.tenantId,
    membershipId: args.membershipId,
    courseId: args.courseId,
  });
  if (existing) {
    return { status: "already_issued", certificateId: existing.id };
  }

  const templateId =
    settings.templateId ??
    (await courseCertificateIssuanceRepository.findFirstPublishedTemplateId(tx, ctx.tenantId));

  const completionPercent = await courseCertificateIssuanceRepository.getCourseCompletionPercent({
    tx,
    tenantId: ctx.tenantId,
    courseId: args.courseId,
    membershipId: args.membershipId,
  });

  const assessmentIdByLessonId =
    await courseCertificateIssuanceRepository.loadAssessmentIdsForLessons(
      tx,
      settings.certificateTests.map((test) => test.lessonId),
    );

  const assessmentIds = [...new Set([...assessmentIdByLessonId.values()])];
  const attemptsByAssessmentId =
    await courseCertificateIssuanceRepository.loadGradedAttemptsForAssessments({
      tx,
      tenantId: ctx.tenantId,
      membershipId: args.membershipId,
      assessmentIds,
    });

  const eligibility = evaluateCourseCertificateEligibility({
    settings,
    courseStatus: course.status,
    completionPercent,
    attemptsByAssessmentId,
    assessmentIdByLessonId,
    hasTemplate: templateId != null,
  });

  if (!eligibility.eligible) {
    return { status: "skipped", reason: eligibility.reason };
  }

  if (!templateId) {
    return { status: "skipped", reason: "TEMPLATE_MISSING" };
  }

  try {
    const issued = await issueCertificate(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: SYSTEM_ACTOR_MEMBERSHIP_ID,
        requestId: ctx.requestId,
      },
      {
        templateId,
        recipientMembershipId: args.membershipId,
        source: { type: "course", id: args.courseId },
        ...(settings.validityDays != null ? { validityDays: settings.validityDays } : {}),
      },
      `course-certificate:${args.courseId}:${args.membershipId}:${args.sourceEventId}`,
    );

    return { status: "issued", certificateId: issued.data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ISSUE_FAILED";
    return { status: "skipped", reason: `ISSUE_FAILED:${message}` };
  }
}

export async function handleCourseCertificateSourceEvent(
  tx: TenantTx,
  ctx: { tenantId: string; requestId: string },
  event: {
    id: string;
    eventType: string;
    payload: unknown;
  },
): Promise<CourseCertificateIssuanceOutcome> {
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    return { status: "skipped", reason: "INVALID_PAYLOAD" };
  }

  const payload = event.payload as Record<string, unknown>;
  const membershipId = resolveMembershipId(event.eventType, payload);
  if (!membershipId) {
    return { status: "skipped", reason: "MEMBERSHIP_MISSING" };
  }

  const courseId = await resolveCourseIdFromEvent({
    tx,
    eventType: event.eventType,
    payload,
  });
  if (!courseId) {
    return { status: "skipped", reason: "COURSE_NOT_RESOLVED" };
  }

  return maybeIssueCourseCertificate(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: membershipId,
      requestId: ctx.requestId,
    },
    {
      courseId,
      membershipId,
      sourceEventId: event.id,
    },
  );
}
