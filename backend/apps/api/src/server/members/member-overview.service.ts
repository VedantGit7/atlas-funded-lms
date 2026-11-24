import { headers } from "next/headers";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { auditWriter } from "@atlas/audit";
import { listHeldPermissionKeys } from "@atlas/authorization";
import { authRequestContextFromHeaders, requestPasswordResetWithBetterAuth } from "@atlas/auth";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";
import { sendAuthEmails } from "../../lib/auth-email";
import {
  memberOverviewResponseSchema,
  memberPasswordResetResponseSchema,
} from "./member-overview.schemas";
import { memberOverviewRepository } from "./member-overview.repository";

type ServiceCtx = { tenantId: string; actorMembershipId: string; requestId: string };

const LIST_LIMIT = 25;
/** Payments are shown to staff who can read payment reports. */
const PAYMENT_READ_PERMISSION = "reports.run";

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}

const ACTIVITY_KINDS = ["enrolled", "lesson_completed", "assessment_submitted", "payment"] as const;

/**
 * The admin member page as a learner profile (QA review 2 H22): courses with
 * progress, assessment scores, payments and recent activity.
 */
export async function getMemberOverview(tx: TenantTx, ctx: ServiceCtx, membershipId: string) {
  await requireMembershipById({ tx, tenantId: ctx.tenantId, membershipId });

  const canSeePayments =
    (
      await listHeldPermissionKeys({
        tx,
        tenantId: ctx.tenantId,
        membershipId: ctx.actorMembershipId,
        permissionKeys: [PAYMENT_READ_PERMISSION],
      })
    ).length > 0;

  const identity = await memberOverviewRepository.findIdentity(tx, membershipId);
  const courses = await memberOverviewRepository.listCourses(tx, membershipId, 50);
  const assessments = await memberOverviewRepository.listAssessments(tx, membershipId, LIST_LIMIT);
  const assessmentTotals = await memberOverviewRepository.countAssessments(tx, membershipId);
  const payments = canSeePayments
    ? await memberOverviewRepository.listPayments(tx, membershipId, LIST_LIMIT)
    : null;
  const activity = await memberOverviewRepository.listActivity(
    tx,
    membershipId,
    canSeePayments,
    LIST_LIMIT,
  );

  const courseItems = courses.map((row) => {
    const total = Number(row.total_lessons);
    const done = Math.min(Number(row.completed_lessons), total);
    return {
      enrollmentId: row.enrollment_id,
      courseId: row.course_id,
      title: row.title,
      status: row.status,
      enrolledAt: row.enrolled_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null,
      completedLessons: done,
      totalLessons: total,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  return memberOverviewResponseSchema.parse({
    data: {
      email: identity.email,
      lastActiveAt: identity.last_active_at?.toISOString() ?? null,
      summary: {
        coursesEnrolled: courseItems.length,
        coursesCompleted: courseItems.filter(
          (course) =>
            course.completedAt != null ||
            (course.totalLessons > 0 && course.completedLessons === course.totalLessons),
        ).length,
        assessmentsTaken: Number(assessmentTotals.taken),
        averageScore: round1(toNumber(assessmentTotals.average)),
      },
      courses: courseItems,
      assessments: assessments.map((row) => ({
        attemptId: row.attempt_id,
        assessmentTitle: row.assessment_title,
        status: row.status,
        scorePercent: round1(toNumber(row.score_pct)),
        submittedAt: row.submitted_at?.toISOString() ?? null,
      })),
      payments:
        payments?.map((row) => ({
          orderId: row.id,
          description: row.product_title,
          amountCents: row.amount_cents,
          currency: row.currency,
          status: row.status,
          createdAt: row.created_at.toISOString(),
          paidAt: row.paid_at?.toISOString() ?? null,
        })) ?? null,
      activity: activity
        .filter((row): row is typeof row & { kind: (typeof ACTIVITY_KINDS)[number] } =>
          (ACTIVITY_KINDS as readonly string[]).includes(row.kind),
        )
        .map((row) => ({
          kind: row.kind,
          title: row.title ?? "",
          occurredAt: row.occurred_at.toISOString(),
        })),
    },
  });
}

/**
 * Emails the member a link to choose a new password, the same email as
 * "Forgot password" (QA review 2 H22: an admin had no way to help a learner
 * who was locked out). The admin never sees or sets the password.
 */
export async function sendMemberPasswordReset(tx: TenantTx, ctx: ServiceCtx, membershipId: string) {
  const membership = await requireMembershipById({ tx, tenantId: ctx.tenantId, membershipId });
  if (membership.status !== "ACTIVE") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Only an active member can be sent a password reset.",
    });
  }
  const { email } = await memberOverviewRepository.findIdentity(tx, membershipId);
  if (!email) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "This member has no email address to send a reset link to.",
    });
  }

  const incoming = new Headers(await headers());
  const { emails } = await requestPasswordResetWithBetterAuth({
    ctx: authRequestContextFromHeaders(incoming),
    email,
  });
  await sendAuthEmails({
    req: new Request("http://localhost/", { headers: incoming }),
    requestId: ctx.requestId,
    emails,
    tenant: { tx, tenantId: ctx.tenantId },
  });

  // Who sent it and to which member; the address itself stays out of the trail.
  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "identity.membership.password_reset_sent",
      target: { type: "membership", id: membershipId },
      before: null,
      after: null,
      reason: null,
      metadata: {},
    },
  );

  return memberPasswordResetResponseSchema.parse({ data: { sent: true, email } });
}
