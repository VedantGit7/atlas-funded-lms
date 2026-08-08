import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const LIVE_ATTENDANCE_COLUMNS = [
  "learner_name",
  "email",
  "status",
  "joined_at",
  "left_at",
  "duration_seconds",
] as const;

export type LiveAttendanceColumn = (typeof LIVE_ATTENDANCE_COLUMNS)[number];

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

export const liveSessionsListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
    courseId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    startedFrom: z.string().datetime().optional(),
    startedTo: z.string().datetime().optional(),
    sortBy: z
      .enum(["started_at", "scheduled_at", "title", "attendance_count", "duration_seconds"])
      .default("scheduled_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type LiveSessionsListQuery = z.output<typeof liveSessionsListQuerySchema>;

export const liveSessionListItemSchema = z
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
    attendanceCount: z.number().int().nonnegative(),
    registeredCount: z.number().int().nonnegative(),
  })
  .strict();

export const liveSessionsListResponseSchema = z.object({
  data: z.object({
    items: z.array(liveSessionListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const liveSessionIdParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const liveSessionDetailResponseSchema = z.object({
  data: liveSessionListItemSchema.extend({
    totalAttendanceSeconds: z.number().int().nonnegative(),
    avgDurationSeconds: z.number().int().nonnegative().nullable(),
  }),
});

export const liveAttendeesQuerySchema = rejectClientTenantFields
  .extend({
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["registered", "attended", "absent"]).optional(),
    joinedFrom: z.string().datetime().optional(),
    joinedTo: z.string().datetime().optional(),
    sortBy: z
      .enum(["joined_at", "left_at", "learner_name", "email", "status", "duration_seconds"])
      .default("joined_at"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    columns: z.preprocess(
      (value) => parseColumns(LIVE_ATTENDANCE_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type LiveAttendeesQuery = z.output<typeof liveAttendeesQuerySchema>;

export const liveAttendeeItemSchema = z
  .object({
    id: z.string().uuid(),
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    status: z.string(),
    joinedAt: z.string().datetime().nullable(),
    leftAt: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nullable(),
  })
  .strict();

export const liveAttendeesListResponseSchema = z.object({
  data: z.object({
    sessionId: z.string().uuid(),
    sessionTitle: z.string(),
    items: z.array(liveAttendeeItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const exportLiveClassAttendanceRosterBodySchema = rejectClientTenantFields
  .extend({
    sessionId: z.string().uuid().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["registered", "attended", "absent"]).optional(),
    joinedFrom: z.string().datetime().optional(),
    joinedTo: z.string().datetime().optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportLiveClassAttendanceRosterResponseSchema = z.object({
  data: z.object({
    runId: z.string().uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});
