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
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    startedFrom: z.iso.datetime().optional(),
    startedTo: z.iso.datetime().optional(),
    attendanceRateBand: z.enum(["below_40", "mid_40_75", "above_75"]).optional(),
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
    attendanceCount: z.number().int().nonnegative(),
    registeredCount: z.number().int().nonnegative(),
    avgCoverageSeconds: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

export const liveSessionsListSummarySchema = z
  .object({
    sessionsHeld: z.number().int().nonnegative(),
    cancelledCount: z.number().int().nonnegative(),
    scheduledAheadCount: z.number().int().nonnegative(),
    avgAttendancePct: z.number().nullable(),
    totalAttendedCount: z.number().int().nonnegative(),
    totalRegisteredCount: z.number().int().nonnegative(),
    totalTimeSeconds: z.number().int().nonnegative(),
    avgCoveragePct: z.number().nullable(),
    lowTurnoutCount: z.number().int().nonnegative(),
  })
  .strict();

export type LiveSessionsListSummary = z.output<typeof liveSessionsListSummarySchema>;

export const liveSessionsListResponseSchema = z.object({
  data: z.object({
    items: z.array(liveSessionListItemSchema),
    pageInfo: pageInfoSchema,
    summary: liveSessionsListSummarySchema,
  }),
});

export const liveClassSessionIdParamsSchema = z
  .object({
    sessionId: z.uuid(),
  })
  .strict();

export const liveSessionDetailResponseSchema = z.object({
  data: liveSessionListItemSchema.extend({
    totalAttendanceSeconds: z.number().int().nonnegative(),
    avgDurationSeconds: z.number().int().nonnegative().nullable(),
    absentCount: z.number().int().nonnegative(),
    avgCoveragePct: z.number().nullable(),
    startDelayMinutes: z.number().int().nullable(),
    cancelledAt: z.iso.datetime().nullable(),
    nextSessionAt: z.iso.datetime().nullable(),
    nextSessionTitle: z.string().nullable(),
    expectedTurnoutCount: z.number().int().nonnegative().nullable(),
    expectedTurnoutPct: z.number().nullable(),
    recordingUrl: z.url().nullable().optional(),
    peakConcurrent: z.number().int().nonnegative().nullable(),
    peakConcurrentAt: z.iso.datetime().nullable(),
    peakConcurrentOffsetMinutes: z.number().int().nullable(),
    timeline: z.object({
      bucketMinutes: z.number().int().positive(),
      points: z.array(
        z.object({
          offsetMinutes: z.number().int().nonnegative(),
          concurrent: z.number().int().nonnegative(),
        }),
      ),
      dropInsight: z
        .object({
          fromOffsetMinutes: z.number().int().nonnegative(),
          toOffsetMinutes: z.number().int().nonnegative(),
          learnersLeft: z.number().int().nonnegative(),
          message: z.string(),
        })
        .nullable(),
    }),
  }),
});

export const sendLiveClassAttendanceMessageBodySchema = rejectClientTenantFields
  .extend({
    sessionId: z.uuid().optional(),
    membershipIds: z.array(z.uuid()).min(1).max(500).optional(),
    audience: z
      .enum(["absentees", "selected", "registrants", "low_attendance"])
      .default("absentees"),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    channels: z
      .array(z.enum(["email", "in_app"]))
      .min(1)
      .max(2)
      .default(["email"]),
    sendTestToSelf: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.sessionId && value.audience !== "selected" && value.audience !== "low_attendance") {
      ctx.addIssue({
        code: "custom",
        message: "sessionId is required unless messaging selected or low-attendance learners.",
        path: ["sessionId"],
      });
    }
    if (
      !value.sessionId &&
      value.audience === "selected" &&
      (!value.membershipIds || value.membershipIds.length === 0) &&
      !value.sendTestToSelf
    ) {
      ctx.addIssue({
        code: "custom",
        message: "membershipIds are required when messaging selected learners without a session.",
        path: ["membershipIds"],
      });
    }
  });

export type SendLiveClassAttendanceMessageBody = z.output<
  typeof sendLiveClassAttendanceMessageBodySchema
>;

export const sendLiveClassAttendanceMessageResponseSchema = z.object({
  data: z.object({
    sendGroupId: z.uuid(),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
    status: z.enum(["sent", "partially_failed", "failed"]),
  }),
});

export const liveAttendeesQuerySchema = rejectClientTenantFields
  .extend({
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["registered", "attended", "absent"]).optional(),
    joinedFrom: z.iso.datetime().optional(),
    joinedTo: z.iso.datetime().optional(),
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
    id: z.uuid(),
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    status: z.string(),
    joinedAt: z.iso.datetime().nullable(),
    leftAt: z.iso.datetime().nullable(),
    durationSeconds: z.number().int().nullable(),
  })
  .strict();

export const liveAttendeesListResponseSchema = z.object({
  data: z.object({
    sessionId: z.uuid(),
    sessionTitle: z.string(),
    items: z.array(liveAttendeeItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const exportLiveClassAttendanceRosterBodySchema = rejectClientTenantFields
  .extend({
    sessionId: z.uuid().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["registered", "attended", "absent"]).optional(),
    joinedFrom: z.iso.datetime().optional(),
    joinedTo: z.iso.datetime().optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportLiveClassAttendanceRosterResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

export const liveClassAttendeeParamsSchema = z
  .object({
    sessionId: z.uuid(),
    attendeeId: z.uuid(),
  })
  .strict();

export const liveAttendeePresenceSegmentSchema = z
  .object({
    id: z.uuid(),
    index: z.number().int().positive(),
    joinedAt: z.iso.datetime().nullable(),
    leftAt: z.iso.datetime().nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    shareOfSessionPct: z.number().nullable(),
    clientLabel: z.string().nullable(),
  })
  .strict();

export const liveAttendeeHistoryItemSchema = z
  .object({
    sessionId: z.uuid(),
    attendeeId: z.uuid().nullable(),
    title: z.string(),
    scheduledAt: z.iso.datetime().nullable(),
    status: z.string(),
    coveragePct: z.number().nullable(),
    durationSeconds: z.number().int().nullable(),
    isCurrent: z.boolean(),
  })
  .strict();

export const liveAttendeeDetailResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    sessionId: z.uuid(),
    sessionTitle: z.string(),
    sessionStatus: z.string(),
    sessionScheduledAt: z.iso.datetime().nullable(),
    sessionStartedAt: z.iso.datetime().nullable(),
    sessionEndedAt: z.iso.datetime().nullable(),
    sessionDurationSeconds: z.number().int().nonnegative().nullable(),
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    status: z.enum(["registered", "attended", "absent"]),
    systemInferredStatus: z.enum(["registered", "attended", "absent"]),
    contradictsSystemData: z.boolean(),
    registeredAt: z.iso.datetime().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    joinedAt: z.iso.datetime().nullable(),
    leftAt: z.iso.datetime().nullable(),
    durationSeconds: z.number().int().nullable(),
    coveragePct: z.number().nullable(),
    joinDelayMinutes: z.number().int().nullable(),
    rejoinCount: z.number().int().nonnegative(),
    longestGapSeconds: z.number().int().nonnegative().nullable(),
    overrideReason: z.string().nullable(),
    overriddenAt: z.iso.datetime().nullable(),
    segments: z.array(liveAttendeePresenceSegmentSchema),
    standing: z.object({
      band: z.enum(["above_median", "at_median", "below_median", "absent", "unavailable"]),
      label: z.string(),
      learnerDurationSeconds: z.number().int().nullable(),
      medianDurationSeconds: z.number().int().nullable(),
      cohortSize: z.number().int().nonnegative(),
      histogram: z.array(z.number().int().nonnegative()),
      learnerBucketIndex: z.number().int().nullable(),
      medianBucketIndex: z.number().int().nullable(),
    }),
    historySummary: z.object({
      attendedCount: z.number().int().nonnegative(),
      totalSessions: z.number().int().nonnegative(),
      attendanceRatePct: z.number().nullable(),
    }),
    history: z.array(liveAttendeeHistoryItemSchema),
  }),
});

export const updateLiveClassAttendeeStatusBodySchema = rejectClientTenantFields
  .extend({
    status: z.enum(["registered", "attended", "absent"]),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export type UpdateLiveClassAttendeeStatusBody = z.output<
  typeof updateLiveClassAttendeeStatusBodySchema
>;

export const updateLiveClassAttendeeStatusResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    status: z.enum(["registered", "attended", "absent"]),
    contradictsSystemData: z.boolean(),
    overrideReason: z.string().nullable(),
    overriddenAt: z.iso.datetime().nullable(),
  }),
});

export const liveClassSessionLiveMonitorResponseSchema = z.object({
  data: z.object({
    sessionId: z.uuid(),
    title: z.string(),
    status: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    scheduledAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
    scheduledDurationSeconds: z.number().int().nonnegative().nullable(),
    serverNow: z.iso.datetime(),
    elapsedSeconds: z.number().int().nonnegative().nullable(),
    ranForSeconds: z.number().int().nonnegative().nullable(),
    frozen: z.boolean(),
    turnout: z.object({
      joinedCount: z.number().int().nonnegative(),
      registeredCount: z.number().int().nonnegative(),
      presentCount: z.number().int().nonnegative(),
      leftCount: z.number().int().nonnegative(),
      notJoinedCount: z.number().int().nonnegative(),
      ratePct: z.number().nullable(),
      joinedLast5Min: z.number().int().nonnegative(),
    }),
    timeline: z.object({
      bucketMinutes: z.number().int().positive(),
      plannedMinutes: z.number().int().positive(),
      asOfOffsetMinutes: z.number().int().nonnegative(),
      points: z.array(
        z.object({
          offsetMinutes: z.number().int().nonnegative(),
          concurrent: z.number().int().nonnegative(),
        }),
      ),
      currentConcurrent: z.number().int().nonnegative(),
      peakConcurrent: z.number().int().nonnegative().nullable(),
      peakConcurrentOffsetMinutes: z.number().int().nullable(),
      peakConcurrentAt: z.iso.datetime().nullable(),
    }),
    recentEvents: z.array(
      z.object({
        kind: z.enum(["joined", "left"]),
        at: z.iso.datetime(),
        membershipId: z.uuid(),
        attendeeId: z.uuid(),
        learnerName: z.string().nullable(),
        email: z.string().nullable(),
        durationSeconds: z.number().int().nullable(),
      }),
    ),
    presence: z.array(
      z.object({
        membershipId: z.uuid(),
        attendeeId: z.uuid(),
        learnerName: z.string().nullable(),
        email: z.string().nullable(),
        state: z.enum(["present", "left", "not_joined"]),
        joinedAt: z.iso.datetime().nullable(),
        leftAt: z.iso.datetime().nullable(),
        durationSeconds: z.number().int().nullable(),
      }),
    ),
    notYetJoined: z.array(
      z.object({
        membershipId: z.uuid(),
        attendeeId: z.uuid(),
        learnerName: z.string().nullable(),
        email: z.string().nullable(),
        batchId: z.uuid().nullable(),
        batchName: z.string().nullable(),
        lastSessionStatus: z.string().nullable(),
        attendanceRatePct: z.number().nullable(),
      }),
    ),
  }),
});

export type LiveClassSessionLiveMonitor = z.output<
  typeof liveClassSessionLiveMonitorResponseSchema
>["data"];

export const LIVE_LEARNER_ATTENDANCE_COLUMNS = [
  "learner_name",
  "email",
  "batch",
  "registered_count",
  "attended_count",
  "attendance_rate",
  "absent_count",
  "total_time",
  "avg_coverage",
  "last_attended",
  "streak",
] as const;

export type LiveLearnerAttendanceColumn = (typeof LIVE_LEARNER_ATTENDANCE_COLUMNS)[number];

export const liveLearnersListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    scheduledFrom: z.iso.datetime().optional(),
    scheduledTo: z.iso.datetime().optional(),
    attendanceRateBand: z
      .enum(["below_40", "mid_40_75", "above_75", "never_attended", "perfect"])
      .optional(),
    sessionsRegisteredBand: z.enum(["1", "2_5", "gt_5"]).optional(),
    lastAttended: z.enum(["last_7d", "last_30d", "never", "not_in_30d"]).optional(),
    sortBy: z
      .enum([
        "attendance_rate",
        "sessions_attended",
        "total_time",
        "last_attended",
        "learner_name",
        "registered_count",
      ])
      .default("attendance_rate"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    columns: z.preprocess(
      (value) => parseColumns(LIVE_LEARNER_ATTENDANCE_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type LiveLearnersListQuery = z.output<typeof liveLearnersListQuerySchema>;

export const liveLearnerListItemSchema = z
  .object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    registeredCount: z.number().int().nonnegative(),
    attendedCount: z.number().int().nonnegative(),
    absentCount: z.number().int().nonnegative(),
    attendanceRatePct: z.number().nullable(),
    totalTimeSeconds: z.number().int().nonnegative(),
    avgCoveragePct: z.number().nullable(),
    lastAttendedAt: z.iso.datetime().nullable(),
    lastAttendedSessionId: z.uuid().nullable(),
    lastAttendedSessionTitle: z.string().nullable(),
    streakKind: z.enum(["attended", "missed", "none"]),
    streakCount: z.number().int().nonnegative(),
    streakLabel: z.string(),
    health: z.enum(["danger", "warning", "ok"]),
  })
  .strict();

export const liveLearnersListSummarySchema = z
  .object({
    learnersRegistered: z.number().int().nonnegative(),
    avgAttendanceRatePct: z.number().nullable(),
    neverAttendedCount: z.number().int().nonnegative(),
    perfectAttendanceCount: z.number().int().nonnegative(),
    avgCoveragePct: z.number().nullable(),
  })
  .strict();

export const liveLearnersListResponseSchema = z.object({
  data: z.object({
    items: z.array(liveLearnerListItemSchema),
    pageInfo: pageInfoSchema,
    summary: liveLearnersListSummarySchema,
    columns: z.array(z.string()),
  }),
});

export type LiveLearnersListSummary = z.output<typeof liveLearnersListSummarySchema>;
export type LiveLearnerListItem = z.output<typeof liveLearnerListItemSchema>;

export const liveLearnersMatrixQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
    scheduledFrom: z.iso.datetime().optional(),
    scheduledTo: z.iso.datetime().optional(),
    attendanceRateBand: z
      .enum(["below_40", "mid_40_75", "above_75", "never_attended", "perfect"])
      .optional(),
    sessionsRegisteredBand: z.enum(["1", "2_5", "gt_5"]).optional(),
    lastAttended: z.enum(["last_7d", "last_30d", "never", "not_in_30d"]).optional(),
    learnerLimit: z.coerce.number().int().min(1).max(200).default(80),
    sessionLimit: z.coerce.number().int().min(1).max(60).default(24),
  })
  .strict();

export type LiveLearnersMatrixQuery = z.output<typeof liveLearnersMatrixQuerySchema>;

export const liveLearnersMatrixResponseSchema = z.object({
  data: z.object({
    sessions: z.array(
      z.object({
        sessionId: z.uuid(),
        title: z.string(),
        scheduledAt: z.iso.datetime().nullable(),
        turnoutRatePct: z.number().nullable(),
      }),
    ),
    learners: z.array(
      z.object({
        membershipId: z.uuid(),
        learnerName: z.string().nullable(),
        email: z.string().nullable(),
        attendanceRatePct: z.number().nullable(),
        attendedCount: z.number().int().nonnegative(),
        registeredCount: z.number().int().nonnegative(),
        cells: z.array(
          z.object({
            sessionId: z.uuid(),
            cell: z.enum(["attended", "absent", "registered", "not_registered"]),
            attendeeId: z.uuid().nullable(),
          }),
        ),
      }),
    ),
    attentionRequired: z.boolean(),
  }),
});

export type LiveLearnersMatrix = z.output<typeof liveLearnersMatrixResponseSchema>["data"];

export const liveLearnerMembershipIdParamsSchema = z
  .object({
    membershipId: z.uuid(),
  })
  .strict();

export const liveLearnerDetailQuerySchema = rejectClientTenantFields
  .extend({
    scheduledFrom: z.iso.datetime().optional(),
    scheduledTo: z.iso.datetime().optional(),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
  })
  .strict();

export type LiveLearnerDetailQuery = z.output<typeof liveLearnerDetailQuerySchema>;

export const liveLearnerDetailResponseSchema = z.object({
  data: z.object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    registeredCount: z.number().int().nonnegative(),
    attendedCount: z.number().int().nonnegative(),
    absentCount: z.number().int().nonnegative(),
    attendanceRatePct: z.number().nullable(),
    cohortAvgAttendanceRatePct: z.number().nullable(),
    totalTimeSeconds: z.number().int().nonnegative(),
    avgCoveragePct: z.number().nullable(),
    lastAttendedAt: z.iso.datetime().nullable(),
    lastAttendedSessionId: z.uuid().nullable(),
    lastAttendedSessionTitle: z.string().nullable(),
    streakKind: z.enum(["attended", "missed", "none"]),
    streakCount: z.number().int().nonnegative(),
    streakLabel: z.string(),
    atRisk: z.boolean(),
    neverAttended: z.boolean(),
    longestGap: z
      .object({
        missedCount: z.number().int().nonnegative(),
        label: z.string(),
        fromScheduledAt: z.iso.datetime().nullable(),
        toScheduledAt: z.iso.datetime().nullable(),
      })
      .nullable(),
    timing: z.object({
      avgJoinDelayMinutes: z.number().nullable(),
      avgLeaveEarlyMinutes: z.number().nullable(),
      cohortAvgJoinDelayMinutes: z.number().nullable(),
      cohortAvgLeaveEarlyMinutes: z.number().nullable(),
    }),
    monthlyPattern: z.array(
      z.object({
        monthKey: z.string(),
        label: z.string(),
        attendanceRatePct: z.number().nullable(),
        cohortAvgRatePct: z.number().nullable(),
        registeredCount: z.number().int().nonnegative(),
        attendedCount: z.number().int().nonnegative(),
      }),
    ),
    strip: z.array(
      z.object({
        sessionId: z.uuid(),
        attendeeId: z.uuid().nullable(),
        title: z.string(),
        scheduledAt: z.iso.datetime().nullable(),
        status: z.enum(["present", "absent", "partial", "registered"]),
        coveragePct: z.number().nullable(),
      }),
    ),
    sessions: z.array(
      z.object({
        sessionId: z.uuid(),
        attendeeId: z.uuid().nullable(),
        title: z.string(),
        courseTitle: z.string().nullable(),
        batchName: z.string().nullable(),
        scheduledAt: z.iso.datetime().nullable(),
        status: z.enum(["present", "absent", "partial", "registered"]),
        joinedAt: z.iso.datetime().nullable(),
        leftAt: z.iso.datetime().nullable(),
        durationSeconds: z.number().int().nullable(),
        coveragePct: z.number().nullable(),
        joinDelayMinutes: z.number().int().nullable(),
        leaveEarlyMinutes: z.number().int().nullable(),
        cohortAvgDurationSeconds: z.number().int().nullable(),
        note: z.string().nullable(),
      }),
    ),
    related: z.object({
      batchId: z.uuid().nullable(),
      batchName: z.string().nullable(),
      courseId: z.uuid().nullable(),
      courseTitle: z.string().nullable(),
    }),
  }),
});

export type LiveLearnerDetail = z.output<typeof liveLearnerDetailResponseSchema>["data"];

export const liveSeriesListQuerySchema = rejectClientTenantFields
  .extend({
    groupBy: z.enum(["course", "batch"]).default("course"),
    scheduledFrom: z.iso.datetime().optional(),
    scheduledTo: z.iso.datetime().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    sortBy: z
      .enum(["avg_turnout", "sessions_held", "registrations", "never_attending", "title"])
      .default("avg_turnout"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type LiveSeriesListQuery = z.output<typeof liveSeriesListQuerySchema>;

export const liveSeriesSessionPointSchema = z.object({
  sessionId: z.uuid(),
  ordinal: z.number().int().positive(),
  title: z.string(),
  scheduledAt: z.iso.datetime().nullable(),
  status: z.string(),
  cancelled: z.boolean(),
  registeredCount: z.number().int().nonnegative(),
  attendedCount: z.number().int().nonnegative(),
  turnoutPct: z.number().nullable(),
  avgCoveragePct: z.number().nullable(),
});

export const liveSeriesListItemSchema = z.object({
  seriesId: z.uuid(),
  groupBy: z.enum(["course", "batch"]),
  title: z.string(),
  subtitle: z.string().nullable(),
  secondaryId: z.uuid().nullable(),
  sessionsHeld: z.number().int().nonnegative(),
  sessionsTotal: z.number().int().nonnegative(),
  cancelledCount: z.number().int().nonnegative(),
  registrations: z.number().int().nonnegative(),
  avgTurnoutPct: z.number().nullable(),
  avgCoveragePct: z.number().nullable(),
  neverAttendingCount: z.number().int().nonnegative(),
  trendDeltaPts: z.number().nullable(),
  sparkline: z.array(z.number().nullable()),
  nextSessionId: z.uuid().nullable(),
  nextSessionAt: z.iso.datetime().nullable(),
  nextSessionTitle: z.string().nullable(),
  status: z.enum(["running", "finished"]),
});

export const liveSeriesListResponseSchema = z.object({
  data: z.object({
    groupBy: z.enum(["course", "batch"]),
    items: z.array(liveSeriesListItemSchema),
    pageInfo: pageInfoSchema,
    summary: z.object({
      seriesCount: z.number().int().nonnegative(),
      runningCount: z.number().int().nonnegative(),
      finishedCount: z.number().int().nonnegative(),
      sessionsCount: z.number().int().nonnegative(),
      registrationsCount: z.number().int().nonnegative(),
      avgTurnoutPct: z.number().nullable(),
      bestSeries: z
        .object({
          seriesId: z.uuid(),
          title: z.string(),
          avgTurnoutPct: z.number(),
        })
        .nullable(),
      weakestSeries: z
        .object({
          seriesId: z.uuid(),
          title: z.string(),
          avgTurnoutPct: z.number(),
        })
        .nullable(),
      turnoutTrendPts: z.number().nullable(),
    }),
    dropOff: z.object({
      stages: z.array(
        z.object({
          ordinal: z.number().int().positive(),
          label: z.string(),
          retentionPct: z.number().nullable(),
        }),
      ),
      biggestDrop: z
        .object({
          fromOrdinal: z.number().int().positive(),
          toOrdinal: z.number().int().positive(),
          dropPts: z.number(),
          label: z.string(),
        })
        .nullable(),
    }),
  }),
});

export type LiveSeriesListItem = z.output<typeof liveSeriesListItemSchema>;

export const liveSeriesDetailParamsSchema = z
  .object({
    seriesId: z.uuid(),
  })
  .strict();

export const liveSeriesDetailQuerySchema = rejectClientTenantFields
  .extend({
    groupBy: z.enum(["course", "batch"]).default("course"),
    scheduledFrom: z.iso.datetime().optional(),
    scheduledTo: z.iso.datetime().optional(),
  })
  .strict();

export type LiveSeriesDetailQuery = z.output<typeof liveSeriesDetailQuerySchema>;

export const liveSeriesDetailResponseSchema = z.object({
  data: z.object({
    seriesId: z.uuid(),
    groupBy: z.enum(["course", "batch"]),
    title: z.string(),
    subtitle: z.string().nullable(),
    avgTurnoutPct: z.number().nullable(),
    steepestDrop: z
      .object({
        fromOrdinal: z.number().int().positive(),
        toOrdinal: z.number().int().positive(),
        dropPts: z.number(),
        message: z.string(),
      })
      .nullable(),
    sessions: z.array(liveSeriesSessionPointSchema),
  }),
});
