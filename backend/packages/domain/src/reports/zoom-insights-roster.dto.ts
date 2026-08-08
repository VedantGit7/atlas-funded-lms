import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const ZOOM_PARTICIPANT_COLUMNS = [
  "display_name",
  "email",
  "join_time",
  "leave_time",
  "duration_seconds",
] as const;

export type ZoomParticipantColumn = (typeof ZOOM_PARTICIPANT_COLUMNS)[number];

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

export const zoomMeetingsListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    startedFrom: z.string().datetime().optional(),
    startedTo: z.string().datetime().optional(),
    sortBy: z.enum(["started_at", "topic", "attendance_count", "duration_seconds"]).default("started_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ZoomMeetingsListQuery = z.output<typeof zoomMeetingsListQuerySchema>;

export const zoomMeetingListItemSchema = z
  .object({
    id: z.string().uuid(),
    externalMeetingId: z.string(),
    topic: z.string().nullable(),
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    attendanceCount: z.number().int().nonnegative(),
  })
  .strict();

export const zoomMeetingsListResponseSchema = z.object({
  data: z.object({
    items: z.array(zoomMeetingListItemSchema),
    pageInfo: pageInfoSchema,
    connectionStatus: z.enum(["connected", "disconnected", "unknown"]),
  }),
});

export const zoomMeetingIdParamsSchema = z
  .object({
    meetingId: z.string().uuid(),
  })
  .strict();

export const zoomMeetingDetailResponseSchema = z.object({
  data: zoomMeetingListItemSchema.extend({
    totalAttendanceSeconds: z.number().int().nonnegative(),
    avgDurationSeconds: z.number().int().nonnegative().nullable(),
  }),
});

export const zoomParticipantsQuerySchema = rejectClientTenantFields
  .extend({
    displayName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    joinedFrom: z.string().datetime().optional(),
    joinedTo: z.string().datetime().optional(),
    sortBy: z
      .enum(["join_time", "leave_time", "display_name", "email", "duration_seconds"])
      .default("join_time"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    columns: z.preprocess(
      (value) => parseColumns(ZOOM_PARTICIPANT_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ZoomParticipantsQuery = z.output<typeof zoomParticipantsQuerySchema>;

export const zoomParticipantItemSchema = z
  .object({
    id: z.string().uuid(),
    membershipId: z.string().uuid().nullable(),
    externalUserId: z.string().nullable(),
    displayName: z.string().nullable(),
    email: z.string().nullable(),
    joinTime: z.string().datetime().nullable(),
    leaveTime: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nullable(),
  })
  .strict();

export const zoomParticipantsListResponseSchema = z.object({
  data: z.object({
    meetingId: z.string().uuid(),
    topic: z.string().nullable(),
    items: z.array(zoomParticipantItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const exportZoomInsightsRosterBodySchema = rejectClientTenantFields
  .extend({
    meetingId: z.string().uuid().optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    joinedFrom: z.string().datetime().optional(),
    joinedTo: z.string().datetime().optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportZoomInsightsRosterResponseSchema = z.object({
  data: z.object({
    runId: z.string().uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});
