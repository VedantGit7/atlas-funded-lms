import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const SUPER_LIVE_INSIGHT_COLUMNS = [
  "session_id",
  "title",
  "status",
  "course_title",
  "batch_name",
  "scheduled_at",
  "started_at",
  "ended_at",
  "duration_seconds",
  "attended_count",
  "registered_count",
  "absent_count",
  "total_count",
  "avg_duration_seconds",
  "attendance_rate",
] as const;

export type SuperLiveInsightColumn = (typeof SUPER_LIVE_INSIGHT_COLUMNS)[number];

function parseColumns(allowed: readonly string[], value: unknown): string[] {
  const allowedSet = new Set<string>(allowed);
  if (Array.isArray(value)) {
    const selected = value.filter(
      (column): column is string => typeof column === "string" && allowedSet.has(column),
    );
    return selected.length > 0 ? selected : [...allowed];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [...allowed];
  }
  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter((column) => allowedSet.has(column));
  return selected.length > 0 ? selected : [...allowed];
}

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const superLiveInsightsListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
    courseId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    startedFrom: z.string().datetime().optional(),
    startedTo: z.string().datetime().optional(),
    minAttended: z.coerce.number().int().min(0).max(100000).optional(),
    sortBy: z
      .enum([
        "scheduled_at",
        "started_at",
        "title",
        "attended_count",
        "registered_count",
        "duration_seconds",
        "attendance_rate",
        "avg_duration_seconds",
      ])
      .default("scheduled_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(SUPER_LIVE_INSIGHT_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type SuperLiveInsightsListQuery = z.output<typeof superLiveInsightsListQuerySchema>;

export const superLiveInsightItemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
    courseId: z.string().uuid().nullable(),
    courseTitle: z.string().nullable(),
    batchId: z.string().uuid().nullable(),
    batchName: z.string().nullable(),
    scheduledAt: z.string().datetime().nullable(),
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    attendedCount: z.number().int().nonnegative(),
    registeredCount: z.number().int().nonnegative(),
    absentCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
    avgDurationSeconds: z.number().int().nonnegative().nullable(),
    attendanceRate: z.number().min(0).max(100).nullable(),
  })
  .strict();

export const superLiveInsightsListResponseSchema = z.object({
  data: z.object({
    items: z.array(superLiveInsightItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    summary: z.object({
      sessionCount: z.number().int().nonnegative(),
      totalAttended: z.number().int().nonnegative(),
      totalRegistered: z.number().int().nonnegative(),
      avgAttendanceRate: z.number().min(0).max(100).nullable(),
    }),
  }),
});

export const superLiveSessionIdParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const superLiveInsightDetailResponseSchema = z.object({
  data: superLiveInsightItemSchema,
});

export const exportSuperLiveInsightsRosterBodySchema = rejectClientTenantFields
  .extend({
    sessionId: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
    courseId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    startedFrom: z.string().datetime().optional(),
    startedTo: z.string().datetime().optional(),
    minAttended: z.number().int().min(0).max(100000).optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportSuperLiveInsightsRosterResponseSchema = z.object({
  data: z.object({
    runId: z.string().uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});
