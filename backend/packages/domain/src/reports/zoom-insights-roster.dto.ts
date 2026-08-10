import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const ZOOM_PARTICIPANT_COLUMNS = [
  "display_name",
  "email",
  "join_time",
  "leave_time",
  "duration_seconds",
  "match_state",
  "coverage",
  "rejoins",
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
    view: z.enum(["all", "has_unmatched", "no_participants"]).default("all"),
    sortBy: z
      .enum(["started_at", "topic", "attendance_count", "duration_seconds"])
      .default("started_at"),
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
    matchedCount: z.number().int().nonnegative(),
    unmatchedCount: z.number().int().nonnegative(),
    totalAttendanceSeconds: z.number().int().nonnegative(),
  })
  .strict();

export const zoomConnectionMetaSchema = z.object({
  status: z.enum(["connected", "disconnected", "unknown"]),
  connectedAt: z.string().datetime().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  meetingsImportedToday: z.number().int().nonnegative(),
  hasConnectionRecord: z.boolean(),
});

export const zoomMeetingsListSummarySchema = z.object({
  meetingCount: z.number().int().nonnegative(),
  participantCount: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  unmatchedCount: z.number().int().nonnegative(),
  totalAttendanceSeconds: z.number().int().nonnegative(),
  avgAttendancePerMeeting: z.number().nullable(),
  avgDurationSeconds: z.number().int().nonnegative().nullable(),
});

export const zoomMeetingsListResponseSchema = z.object({
  data: z.object({
    items: z.array(zoomMeetingListItemSchema),
    pageInfo: pageInfoSchema,
    connectionStatus: z.enum(["connected", "disconnected", "unknown"]),
    connection: zoomConnectionMetaSchema,
    summary: zoomMeetingsListSummarySchema,
  }),
});

export const zoomMeetingIdParamsSchema = z
  .object({
    meetingId: z.string().uuid(),
  })
  .strict();

export const zoomTimelinePointSchema = z.object({
  minuteOffset: z.number().int().nonnegative(),
  at: z.string().datetime(),
  concurrent: z.number().int().nonnegative(),
});

export const zoomMeetingDetailResponseSchema = z.object({
  data: zoomMeetingListItemSchema.extend({
    avgDurationSeconds: z.number().int().nonnegative().nullable(),
    connection: zoomConnectionMetaSchema,
    timeline: z.array(zoomTimelinePointSchema),
    peakConcurrent: z.number().int().nonnegative(),
    peakAt: z.string().datetime().nullable(),
    biggestDropCount: z.number().int().nonnegative(),
    biggestDropFrom: z.string().datetime().nullable(),
    biggestDropTo: z.string().datetime().nullable(),
    linkedSession: z
      .object({
        id: z.string(),
        title: z.string(),
        lmsAttendanceCount: z.number().int().nonnegative().nullable(),
      })
      .nullable(),
  }),
});

export const zoomParticipantsQuerySchema = rejectClientTenantFields
  .extend({
    displayName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    joinedFrom: z.string().datetime().optional(),
    joinedTo: z.string().datetime().optional(),
    matchState: z.enum(["all", "matched", "unmatched", "guest"]).default("all"),
    durationBucket: z.enum(["any", "under_10", "10_to_30", "over_30"]).default("any"),
    rejoinedOnly: z.coerce.boolean().default(false),
    sortBy: z
      .enum(["join_time", "leave_time", "display_name", "email", "duration_seconds", "rejoins"])
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
    zoomDisplayName: z.string().nullable(),
    email: z.string().nullable(),
    joinTime: z.string().datetime().nullable(),
    leaveTime: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nullable(),
    matchState: z.enum(["matched", "unmatched", "guest"]),
    sessionCount: z.number().int().positive(),
    rejoinCount: z.number().int().nonnegative(),
  })
  .strict();

export const zoomParticipantsListResponseSchema = z.object({
  data: z.object({
    meetingId: z.string().uuid(),
    topic: z.string().nullable(),
    meetingDurationSeconds: z.number().int().nonnegative().nullable(),
    items: z.array(zoomParticipantItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    summary: z.object({
      matchedCount: z.number().int().nonnegative(),
      unmatchedCount: z.number().int().nonnegative(),
      guestCount: z.number().int().nonnegative(),
    }),
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

export const zoomParticipantParamsSchema = z
  .object({
    meetingId: z.string().uuid(),
    participantId: z.string().uuid(),
  })
  .strict();

export const zoomParticipantSessionSchema = z
  .object({
    id: z.string().uuid(),
    index: z.number().int().positive(),
    joinTime: z.string().datetime().nullable(),
    leaveTime: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    shareOfMeeting: z.number().nullable(),
    deviceHint: z.enum(["mobile", "tablet", "desktop", "unknown"]),
  })
  .strict();

export const zoomParticipantHistoryItemSchema = z
  .object({
    meetingId: z.string().uuid(),
    topic: z.string().nullable(),
    startedAt: z.string().datetime().nullable(),
    coveragePercent: z.number().nullable(),
    isCurrent: z.boolean(),
  })
  .strict();

export const zoomParticipantDetailResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    meetingTopic: z.string().nullable(),
    meetingExternalId: z.string(),
    meetingStartedAt: z.string().datetime().nullable(),
    meetingEndedAt: z.string().datetime().nullable(),
    meetingDurationSeconds: z.number().int().nonnegative().nullable(),
    membershipId: z.string().uuid().nullable(),
    externalUserId: z.string().nullable(),
    displayName: z.string().nullable(),
    zoomDisplayName: z.string().nullable(),
    email: z.string().nullable(),
    matchState: z.enum(["matched", "unmatched", "guest"]),
    totalDurationSeconds: z.number().int().nonnegative(),
    coveragePercent: z.number().nullable(),
    sessionCount: z.number().int().positive(),
    rejoinCount: z.number().int().nonnegative(),
    firstJoinedAt: z.string().datetime().nullable(),
    lastLeftAt: z.string().datetime().nullable(),
    longestGapSeconds: z.number().int().nonnegative().nullable(),
    deviceHint: z.enum(["mobile", "tablet", "desktop", "unknown"]),
    sessions: z.array(zoomParticipantSessionSchema),
    attendanceHistory: z.array(zoomParticipantHistoryItemSchema),
    lmsCrossCheck: z.object({
      enrollmentStatus: z.enum(["active", "inactive", "unknown", "unlinked"]),
      matchMethod: z.enum(["membership", "exact_email", "none"]),
      zoomDurationSeconds: z.number().int().nonnegative(),
      lmsDurationSeconds: z.number().int().nonnegative().nullable(),
      discrepancySeconds: z.number().int().nullable(),
    }),
    otherUnmatchedMeetingCount: z.number().int().nonnegative(),
  }),
});

export const zoomParticipantMatchBodySchema = rejectClientTenantFields
  .extend({
    action: z.enum(["match", "unlink", "mark_guest"]),
    membershipId: z.string().uuid().optional(),
    applyToOtherMeetings: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === "match" && !value.membershipId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "membershipId is required when matching a learner.",
        path: ["membershipId"],
      });
    }
  });

export type ZoomParticipantMatchBody = z.output<typeof zoomParticipantMatchBodySchema>;

export const zoomParticipantMatchResponseSchema = z.object({
  data: z.object({
    participantId: z.string().uuid(),
    matchState: z.enum(["matched", "unmatched", "guest"]),
    membershipId: z.string().uuid().nullable(),
    updatedRowCount: z.number().int().nonnegative(),
    updatedMeetingCount: z.number().int().nonnegative(),
  }),
});

/** Cross-meeting people roster (Zoom Insights → Participants). */
export const zoomPeopleListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    attendedFrom: z.string().datetime().optional(),
    attendedTo: z.string().datetime().optional(),
    matchState: z.enum(["all", "matched", "unmatched", "guest"]).default("all"),
    meetingsMin: z.coerce.number().int().min(0).max(10_000).optional(),
    meetingsMax: z.coerce.number().int().min(0).max(10_000).optional(),
    coverageMin: z.coerce.number().min(0).max(100).optional(),
    coverageMax: z.coerce.number().min(0).max(100).optional(),
    sortBy: z
      .enum([
        "display_name",
        "meetings_attended",
        "total_time",
        "avg_duration",
        "avg_coverage",
        "first_seen",
        "last_seen",
      ])
      .default("meetings_attended"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ZoomPeopleListQuery = z.output<typeof zoomPeopleListQuerySchema>;

export const zoomPersonListItemSchema = z
  .object({
    identityKey: z.string().min(1),
    membershipId: z.string().uuid().nullable(),
    externalUserId: z.string().nullable(),
    displayName: z.string().nullable(),
    zoomDisplayName: z.string().nullable(),
    email: z.string().nullable(),
    matchState: z.enum(["matched", "unmatched", "guest"]),
    meetingsAttended: z.number().int().nonnegative(),
    meetingsInRange: z.number().int().nonnegative(),
    totalDurationSeconds: z.number().int().nonnegative(),
    avgDurationSeconds: z.number().int().nonnegative().nullable(),
    avgCoveragePercent: z.number().nullable(),
    firstSeenAt: z.string().datetime().nullable(),
    lastSeenAt: z.string().datetime().nullable(),
    representativeMeetingId: z.string().uuid(),
    representativeParticipantId: z.string().uuid(),
  })
  .strict();

export const zoomPeopleListSummarySchema = z.object({
  peopleCount: z.number().int().nonnegative(),
  matchedCount: z.number().int().nonnegative(),
  unmatchedCount: z.number().int().nonnegative(),
  guestCount: z.number().int().nonnegative(),
  avgMeetingsAttended: z.number().nullable(),
  totalDurationSeconds: z.number().int().nonnegative(),
  avgCoveragePercent: z.number().nullable(),
  attendedOnceOnlyCount: z.number().int().nonnegative(),
  meetingsInRange: z.number().int().nonnegative(),
});

export const zoomPeopleListResponseSchema = z.object({
  data: z.object({
    items: z.array(zoomPersonListItemSchema),
    pageInfo: pageInfoSchema,
    connectionStatus: z.enum(["connected", "disconnected", "unknown"]),
    connection: zoomConnectionMetaSchema,
    summary: zoomPeopleListSummarySchema,
    range: z.object({
      attendedFrom: z.string().datetime().nullable(),
      attendedTo: z.string().datetime().nullable(),
    }),
  }),
});

export const zoomPersonMeetingsQuerySchema = rejectClientTenantFields
  .extend({
    identityKey: z.string().trim().min(1).max(500),
    attendedFrom: z.string().datetime().optional(),
    attendedTo: z.string().datetime().optional(),
  })
  .strict();

export type ZoomPersonMeetingsQuery = z.output<typeof zoomPersonMeetingsQuerySchema>;

export const zoomPersonMeetingItemSchema = z
  .object({
    meetingId: z.string().uuid(),
    participantId: z.string().uuid(),
    topic: z.string().nullable(),
    externalMeetingId: z.string(),
    startedAt: z.string().datetime().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    coveragePercent: z.number().nullable(),
    rejoinCount: z.number().int().nonnegative(),
  })
  .strict();

export const zoomPersonAttendancePulseCellSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  state: z.enum(["high", "partial", "missed", "none"]),
  coveragePercent: z.number().nullable(),
  meetingCount: z.number().int().nonnegative(),
});

export const zoomPersonMeetingsResponseSchema = z.object({
  data: z.object({
    identityKey: z.string().min(1),
    membershipId: z.string().uuid().nullable(),
    displayName: z.string().nullable(),
    email: z.string().nullable(),
    matchState: z.enum(["matched", "unmatched", "guest"]),
    totalMeetings: z.number().int().nonnegative(),
    totalDurationSeconds: z.number().int().nonnegative(),
    avgCoveragePercent: z.number().nullable(),
    meetings: z.array(zoomPersonMeetingItemSchema),
    attendancePulse: z.array(zoomPersonAttendancePulseCellSchema),
    representativeMeetingId: z.string().uuid().nullable(),
    representativeParticipantId: z.string().uuid().nullable(),
  }),
});

/** Unmatched identities workbench. */
export const zoomUnmatchedListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    attendedFrom: z.string().datetime().optional(),
    attendedTo: z.string().datetime().optional(),
    group: z.enum(["all", "high", "medium", "guest", "none"]).default("all"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ZoomUnmatchedListQuery = z.output<typeof zoomUnmatchedListQuerySchema>;

export const zoomMatchSuggestionSchema = z
  .object({
    membershipId: z.string().uuid(),
    displayName: z.string().nullable(),
    email: z.string().nullable(),
    confidence: z.enum(["high", "medium", "low"]),
    reason: z.enum(["exact_email", "normalized_display_name", "domain_plus_enrollment"]),
    reasonLabel: z.string(),
  })
  .strict();

export const zoomUnmatchedIdentitySchema = z
  .object({
    identityKey: z.string().min(1),
    displayName: z.string().nullable(),
    email: z.string().nullable(),
    externalUserId: z.string().nullable(),
    meetingsAttended: z.number().int().nonnegative(),
    totalDurationSeconds: z.number().int().nonnegative(),
    firstSeenAt: z.string().datetime().nullable(),
    lastSeenAt: z.string().datetime().nullable(),
    representativeMeetingId: z.string().uuid(),
    representativeParticipantId: z.string().uuid(),
    otherUnmatchedMeetingCount: z.number().int().nonnegative(),
    group: z.enum(["high", "medium", "guest", "none"]),
    suggestions: z.array(zoomMatchSuggestionSchema),
  })
  .strict();

export const zoomUnmatchedSummarySchema = z.object({
  unmatchedIdentities: z.number().int().nonnegative(),
  meetingCount: z.number().int().nonnegative(),
  joinRecordCount: z.number().int().nonnegative(),
  highConfidence: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  likelyGuests: z.number().int().nonnegative(),
  attendanceNotCountedSeconds: z.number().int().nonnegative(),
  reconciledLast30Days: z.number().int().nonnegative(),
});

export const zoomUnmatchedListResponseSchema = z.object({
  data: z.object({
    items: z.array(zoomUnmatchedIdentitySchema),
    groups: z.object({
      high: z.array(zoomUnmatchedIdentitySchema),
      medium: z.array(zoomUnmatchedIdentitySchema),
      guest: z.array(zoomUnmatchedIdentitySchema),
      none: z.array(zoomUnmatchedIdentitySchema),
    }),
    pageInfo: pageInfoSchema,
    connectionStatus: z.enum(["connected", "disconnected", "unknown"]),
    connection: zoomConnectionMetaSchema,
    summary: zoomUnmatchedSummarySchema,
  }),
});

export const zoomMatchingRulesSchema = z
  .object({
    matchOnExactEmail: z.boolean(),
    matchOnNormalizedDisplayName: z.boolean(),
    matchOnEmailDomainPlusEnrollment: z.boolean(),
    autoMatchHighConfidenceOnImport: z.boolean(),
    guestEmailDomains: z.array(z.string().trim().min(1).max(253)).max(50),
  })
  .strict();

export const zoomMatchingRulesResponseSchema = z.object({
  data: zoomMatchingRulesSchema,
});

export const zoomMatchingRulesBodySchema = rejectClientTenantFields
  .extend({
    matchOnExactEmail: z.boolean(),
    matchOnNormalizedDisplayName: z.boolean(),
    matchOnEmailDomainPlusEnrollment: z.boolean(),
    autoMatchHighConfidenceOnImport: z.boolean(),
    guestEmailDomains: z.array(z.string().trim().toLowerCase().min(1).max(253)).max(50).default([]),
  })
  .strict();

export type ZoomMatchingRulesBody = z.output<typeof zoomMatchingRulesBodySchema>;

export const zoomUnmatchedBulkMatchBodySchema = rejectClientTenantFields
  .extend({
    mode: z.enum(["selected", "all_high"]).default("selected"),
    applyToOtherMeetings: z.boolean().default(true),
    items: z
      .array(
        z
          .object({
            identityKey: z.string().min(1).max(500),
            membershipId: z.string().uuid(),
            representativeMeetingId: z.string().uuid(),
            representativeParticipantId: z.string().uuid(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "selected" && (!value.items || value.items.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "items are required when mode is selected.",
        path: ["items"],
      });
    }
  });

export type ZoomUnmatchedBulkMatchBody = z.output<typeof zoomUnmatchedBulkMatchBodySchema>;

export const zoomUnmatchedBulkMatchResponseSchema = z.object({
  data: z.object({
    matchedCount: z.number().int().nonnegative(),
    updatedRowCount: z.number().int().nonnegative(),
    updatedMeetingCount: z.number().int().nonnegative(),
    results: z.array(
      z.object({
        identityKey: z.string(),
        membershipId: z.string().uuid().nullable(),
        matchState: z.enum(["matched", "unmatched", "guest"]),
        updatedRowCount: z.number().int().nonnegative(),
        updatedMeetingCount: z.number().int().nonnegative(),
        error: z.string().optional(),
      }),
    ),
  }),
});
