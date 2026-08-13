import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const ENROLLMENT_REPORT_TYPES = [
  "free",
  "paid",
  "complimentary",
  "manual",
  "offline",
  "trial",
] as const;

export const ENROLLMENT_ROSTER_COLUMNS = [
  "learner_name",
  "email",
  "product_title",
  "enrolled_type",
  "status",
  "enrolled_at",
  "expires_at",
] as const;

export type EnrollmentRosterColumn = (typeof ENROLLMENT_ROSTER_COLUMNS)[number];

function parseRosterColumns(value: unknown): string[] {
  const allowed = new Set<string>(ENROLLMENT_ROSTER_COLUMNS);
  if (Array.isArray(value)) {
    const selected = value.filter(
      (column): column is string => typeof column === "string" && allowed.has(column),
    );
    return selected.length > 0 ? selected : [...ENROLLMENT_ROSTER_COLUMNS];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [...ENROLLMENT_ROSTER_COLUMNS];
  }
  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter((column) => allowed.has(column));
  return selected.length > 0 ? selected : [...ENROLLMENT_ROSTER_COLUMNS];
}

export const enrollmentRosterQuerySchema = rejectClientTenantFields
  .extend({
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    email: z.string().trim().min(1).max(320).optional(),
    enrolledType: z.enum(ENROLLMENT_REPORT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    courseId: z.uuid().optional(),
    sortBy: z.enum(["enrolled_at", "expires_at"]).default("enrolled_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(parseRosterColumns, z.array(z.string().min(1)).min(1)),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type EnrollmentRosterQuery = z.output<typeof enrollmentRosterQuerySchema>;

export const enrollmentOverviewQuerySchema = rejectClientTenantFields
  .extend({
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    email: z.string().trim().min(1).max(320).optional(),
    enrolledType: z.enum(ENROLLMENT_REPORT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    courseId: z.uuid().optional(),
  })
  .strict();

export type EnrollmentOverviewQuery = z.output<typeof enrollmentOverviewQuerySchema>;

export const enrollmentOverviewResponseSchema = z.object({
  data: z.object({
    summary: z.object({
      totalCount: z.number().int().nonnegative(),
      activeCount: z.number().int().nonnegative(),
      expiringSoonCount: z.number().int().nonnegative(),
      previousPeriodCount: z.number().int().nonnegative(),
      changePercent: z.number().nullable(),
      windowLabel: z.string(),
      windowFrom: z.iso.datetime(),
      windowTo: z.iso.datetime(),
    }),
    byType: z.array(
      z.object({
        type: z.string(),
        label: z.string(),
        count: z.number().int().nonnegative(),
        percent: z.number().nonnegative(),
      }),
    ),
    trend: z.array(
      z.object({
        date: z.string(),
        total: z.number().int().nonnegative(),
        paid: z.number().int().nonnegative(),
        free: z.number().int().nonnegative(),
        trial: z.number().int().nonnegative(),
        offline: z.number().int().nonnegative(),
      }),
    ),
  }),
});

export const enrollmentRosterItemSchema = z
  .object({
    id: z.uuid(),
    courseId: z.uuid(),
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    productTitle: z.string(),
    enrolledType: z.string(),
    status: z.string(),
    enrolledAt: z.iso.datetime(),
    expiresAt: z.iso.datetime().nullable(),
  })
  .strict();

export const enrollmentRosterPageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const enrollmentRosterListResponseSchema = z.object({
  data: z.object({
    items: z.array(enrollmentRosterItemSchema),
    pageInfo: enrollmentRosterPageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const createEnrollmentGroupBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().trim().min(1).max(256),
    description: z.string().trim().max(2000).optional(),
    membershipIds: z.array(z.uuid()).min(1).max(2000).optional(),
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    email: z.string().trim().min(1).max(320).optional(),
    enrolledType: z.enum(ENROLLMENT_REPORT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    courseId: z.uuid().optional(),
  })
  .strict();

export const createEnrollmentGroupResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    key: z.string(),
    name: z.string(),
    memberCount: z.number().int().nonnegative(),
  }),
});

export const sendEnrollmentMessageBodySchema = rejectClientTenantFields
  .extend({
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    membershipIds: z.array(z.uuid()).min(1).max(2000).optional(),
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    email: z.string().trim().min(1).max(320).optional(),
    enrolledType: z.enum(ENROLLMENT_REPORT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    courseId: z.uuid().optional(),
  })
  .strict();

export const sendEnrollmentMessageResponseSchema = z.object({
  data: z.object({
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
  }),
});

export const exportEnrollmentRosterBodySchema = rejectClientTenantFields
  .extend({
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
    email: z.string().trim().min(1).max(320).optional(),
    enrolledType: z.enum(ENROLLMENT_REPORT_TYPES).optional(),
    status: z.string().trim().min(1).max(64).optional(),
    courseId: z.uuid().optional(),
    sortBy: z.enum(["enrolled_at", "expires_at"]).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    columns: z.array(z.enum(ENROLLMENT_ROSTER_COLUMNS)).min(1).max(20).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportEnrollmentRosterResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});
