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
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    startedFrom: z.iso.datetime().optional(),
    startedTo: z.iso.datetime().optional(),
    minAttended: z.coerce.number().int().min(0).max(100000).optional(),
    hasUnresolved: z
      .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "boolean") return value;
        return value === "true" || value === "1";
      }),
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
    id: z.uuid(),
    title: z.string(),
    status: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    scheduledAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
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
      totalAbsent: z.number().int().nonnegative(),
      totalRecords: z.number().int().nonnegative(),
      avgAttendanceRate: z.number().min(0).max(100).nullable(),
      avgDurationSeconds: z.number().int().nonnegative().nullable(),
    }),
  }),
});

export const superLiveSessionIdParamsSchema = z
  .object({
    sessionId: z.uuid(),
  })
  .strict();

const superLiveInsightSeriesItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    scheduledAt: z.iso.datetime().nullable(),
    attendanceRate: z.number().min(0).max(100).nullable(),
    isCurrent: z.boolean(),
  })
  .strict();

const superLiveInsightTrendItemSchema = z
  .object({
    id: z.uuid().nullable(),
    title: z.string(),
    label: z.string(),
    attendanceRate: z.number().min(0).max(100).nullable(),
    isCurrent: z.boolean(),
    isFuture: z.boolean(),
  })
  .strict();

export const superLiveInsightContextSchema = z
  .object({
    courseAvgAttendanceRate: z.number().min(0).max(100).nullable(),
    tenantAvgAttendanceRate: z.number().min(0).max(100).nullable(),
    courseRateP25: z.number().min(0).max(100).nullable(),
    courseRateP75: z.number().min(0).max(100).nullable(),
    courseAvgDurationSeconds: z.number().int().nonnegative().nullable(),
    durationCoveragePct: z.number().min(0).max(100).nullable(),
    rateDeltaVsCourse: z.number().nullable(),
    courseRankCaption: z.string().nullable(),
    estimatedTurnout: z.number().int().nonnegative().nullable(),
    cancelledAt: z.iso.datetime().nullable(),
    series: z.array(superLiveInsightSeriesItemSchema),
    trend: z.array(superLiveInsightTrendItemSchema),
    trendDeltaPoints: z.number().nullable(),
  })
  .strict();

export const superLiveInsightDetailResponseSchema = z.object({
  data: z.object({
    session: superLiveInsightItemSchema,
    context: superLiveInsightContextSchema,
  }),
});

export const exportSuperLiveInsightsRosterBodySchema = rejectClientTenantFields
  .extend({
    sessionId: z.uuid().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    startedFrom: z.iso.datetime().optional(),
    startedTo: z.iso.datetime().optional(),
    minAttended: z.number().int().min(0).max(100000).optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportSuperLiveInsightsRosterResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});
