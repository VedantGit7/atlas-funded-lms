import { z } from "zod";

/**
 * One learner, as an admin needs to see them (QA review 2 H22: the member page
 * showed 173 permission keys and none of the learner's courses, scores,
 * payments or activity).
 */
export const memberOverviewCourseSchema = z.object({
  enrollmentId: z.uuid(),
  courseId: z.uuid(),
  title: z.string(),
  /** active, cancelled, expired… as stored. */
  status: z.string(),
  enrolledAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  progressPct: z.number().int().min(0).max(100),
});

export const memberOverviewAssessmentSchema = z.object({
  attemptId: z.uuid(),
  assessmentTitle: z.string(),
  status: z.enum(["SUBMITTED", "GRADED"]),
  scorePercent: z.number().nullable(),
  submittedAt: z.iso.datetime().nullable(),
});

export const memberOverviewPaymentSchema = z.object({
  orderId: z.uuid(),
  description: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
});

export const memberOverviewActivitySchema = z.object({
  kind: z.enum(["enrolled", "lesson_completed", "assessment_submitted", "payment"]),
  title: z.string(),
  occurredAt: z.iso.datetime(),
});

export const memberOverviewResponseSchema = z.object({
  data: z.object({
    email: z.string().nullable(),
    lastActiveAt: z.iso.datetime().nullable(),
    summary: z.object({
      coursesEnrolled: z.number().int().nonnegative(),
      coursesCompleted: z.number().int().nonnegative(),
      assessmentsTaken: z.number().int().nonnegative(),
      averageScore: z.number().nullable(),
    }),
    courses: z.array(memberOverviewCourseSchema),
    assessments: z.array(memberOverviewAssessmentSchema),
    /** Null when the viewer may not see payments (reports.run). */
    payments: z.array(memberOverviewPaymentSchema).nullable(),
    activity: z.array(memberOverviewActivitySchema),
  }),
});

export type MemberOverviewResponse = z.infer<typeof memberOverviewResponseSchema>;

export const memberPasswordResetResponseSchema = z.object({
  data: z.object({ sent: z.literal(true), email: z.string() }),
});
