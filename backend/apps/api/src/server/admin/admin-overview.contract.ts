import { z } from "zod";

export const adminOverviewMonthlyPointSchema = z.object({
  month: z.string(),
  paid: z.number().int().nonnegative(),
  free: z.number().int().nonnegative(),
});

export const adminOverviewTopProductSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  studentCount: z.number().int().nonnegative(),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  href: z.string(),
});

export const adminOverviewScheduledEventSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export const adminOverviewPendingTasksSchema = z.object({
  publishReviews: z.number().int().nonnegative(),
  moderationCases: z.number().int().nonnegative(),
  deletionRequests: z.number().int().nonnegative(),
  courseReviews: z.number().int().nonnegative(),
});

/**
 * Admin overview payload. "Sales" figures are enrollment-value estimates
 * (course price × enrollments) until a payment ledger exists.
 */
export const adminOverviewResponseSchema = z.object({
  data: z.object({
    currency: z.string().min(1),
    kpis: z.object({
      enrollmentValueCents: z.number().int().nonnegative(),
      productCount: z.number().int().nonnegative(),
      learnerCount: z.number().int().nonnegative(),
      enrollmentCount: z.number().int().nonnegative(),
    }),
    enrollmentBreakdown: z.object({
      last12MonthsValueCents: z.number().int().nonnegative(),
      paidValueCents: z.number().int().nonnegative(),
      freeEnrollmentCount: z.number().int().nonnegative(),
      paidEnrollmentCount: z.number().int().nonnegative(),
    }),
    monthlyEnrollments: z.array(adminOverviewMonthlyPointSchema),
    topProducts: z.array(adminOverviewTopProductSchema),
    scheduledEvents: z.array(adminOverviewScheduledEventSchema),
    pendingTasks: adminOverviewPendingTasksSchema,
  }),
});

export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;
