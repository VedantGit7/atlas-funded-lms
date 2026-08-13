import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const BATCH_LEARNER_COLUMNS = [
  "learner_name",
  "email",
  "activity_at",
  "live_attendance_pct",
  "test_score_pct",
  "content_completion_pct",
  "joined_at",
] as const;

export type BatchLearnerColumn = (typeof BATCH_LEARNER_COLUMNS)[number];

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

export const BATCH_LIST_SORT_OPTIONS = [
  "created_at",
  "member_count",
  "avg_content_completion_pct",
  "avg_live_attendance_pct",
  "avg_test_score_pct",
  "starts_at",
  "name",
] as const;

export const BATCH_WINDOW_OPTIONS = [
  "any",
  "running",
  "starting_soon",
  "ending_soon",
  "ended",
] as const;
export const BATCH_HEALTH_OPTIONS = [
  "any",
  "on_track",
  "at_risk",
  "critical",
  "needs_attention",
] as const;

export const batchesListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
    window: z.enum(BATCH_WINDOW_OPTIONS).default("any"),
    health: z.enum(BATCH_HEALTH_OPTIONS).default("any"),
    sortBy: z.enum(BATCH_LIST_SORT_OPTIONS).default("member_count"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type BatchesListQuery = z.output<typeof batchesListQuerySchema>;

export const batchHealthSchema = z.enum(["on_track", "at_risk", "critical"]);

export const batchListItemSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    status: z.string(),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    memberCount: z.number().int().nonnegative(),
    avgContentCompletionPct: z.number().nullable(),
    avgLiveAttendancePct: z.number().nullable(),
    avgTestScorePct: z.number().nullable(),
    lastActivityAt: z.iso.datetime().nullable(),
    health: batchHealthSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();

export const batchesListSummarySchema = z.object({
  activeBatchCount: z.number().int().nonnegative(),
  totalLearners: z.number().int().nonnegative(),
  avgContentCompletionPct: z.number().nullable(),
  avgLiveAttendancePct: z.number().nullable(),
  atRiskCount: z.number().int().nonnegative(),
  endingSoonCount: z.number().int().nonnegative(),
});

export const batchesListResponseSchema = z.object({
  data: z.object({
    items: z.array(batchListItemSchema),
    pageInfo: pageInfoSchema,
    summary: batchesListSummarySchema,
  }),
});

export const batchIdParamsSchema = z
  .object({
    batchId: z.uuid(),
  })
  .strict();

export const batchDetailResponseSchema = z.object({
  data: batchListItemSchema.extend({
    averages: z.object({
      contentCompletionPct: z.number().nullable(),
      liveAttendancePct: z.number().nullable(),
      testScorePct: z.number().nullable(),
      activeLearnerCount: z.number().int().nonnegative(),
      atRiskCount: z.number().int().nonnegative(),
      liveSessionHeldCount: z.number().int().nonnegative(),
      liveSessionTotalCount: z.number().int().nonnegative(),
      passMarkPct: z.number().nullable(),
    }),
    overview: z.object({
      needsAttention: z.array(
        z.object({
          membershipId: z.uuid(),
          learnerName: z.string().nullable(),
          email: z.string().nullable(),
          reason: z.string(),
          health: batchHealthSchema,
          contentCompletionPct: z.number().nullable(),
          liveAttendancePct: z.number().nullable(),
          testScorePct: z.number().nullable(),
        }),
      ),
      upcomingSessions: z.array(
        z.object({
          liveSessionId: z.uuid(),
          title: z.string(),
          scheduledAt: z.iso.datetime().nullable(),
          status: z.string(),
          durationMinutes: z.number().nullable(),
        }),
      ),
      scoreDistribution: z.array(
        z.object({
          bucket: z.enum(["below_60", "from_60_to_80", "above_80"]),
          label: z.string(),
          count: z.number().int().nonnegative(),
        }),
      ),
      cohortTrend: z.array(
        z.object({
          weekLabel: z.string(),
          weekStart: z.iso.datetime(),
          contentCompletionPct: z.number().nullable(),
          liveAttendancePct: z.number().nullable(),
          testScorePct: z.number().nullable(),
        }),
      ),
    }),
  }),
});

export const batchLearnersQuerySchema = rejectClientTenantFields
  .extend({
    learnerName: z.string().trim().min(1).max(200).optional(),
    joinedFrom: z.iso.datetime().optional(),
    joinedTo: z.iso.datetime().optional(),
    minCompletion: z.coerce.number().min(0).max(100).optional(),
    maxCompletion: z.coerce.number().min(0).max(100).optional(),
    health: z.enum(["any", "on_track", "at_risk", "critical", "needs_attention"]).default("any"),
    sortBy: z
      .enum([
        "joined_at",
        "learner_name",
        "activity_at",
        "live_attendance_pct",
        "test_score_pct",
        "content_completion_pct",
      ])
      .default("joined_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(BATCH_LEARNER_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type BatchLearnersQuery = z.output<typeof batchLearnersQuerySchema>;

export const batchLearnerItemSchema = z
  .object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    activityAt: z.iso.datetime().nullable(),
    liveAttendancePct: z.number().nullable(),
    liveAttendedCount: z.number().int().nonnegative(),
    liveSessionCount: z.number().int().nonnegative(),
    testScorePct: z.number().nullable(),
    testAttemptCount: z.number().int().nonnegative(),
    contentCompletionPct: z.number().int().min(0).max(100),
    completedLessons: z.number().int().nonnegative(),
    totalLessons: z.number().int().nonnegative(),
    joinedAt: z.iso.datetime(),
    health: batchHealthSchema,
  })
  .strict();

export const batchLearnersListResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchName: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    items: z.array(batchLearnerItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const batchLearnerParamsSchema = z
  .object({
    batchId: z.uuid(),
    membershipId: z.uuid(),
  })
  .strict();

export const batchLearnerLiveAttendanceItemSchema = z
  .object({
    liveSessionId: z.uuid(),
    title: z.string(),
    scheduledAt: z.iso.datetime().nullable(),
    status: z.string(),
    sessionStatus: z.string(),
    sessionKind: z.string().nullable(),
    joinedAt: z.iso.datetime().nullable(),
    leftAt: z.iso.datetime().nullable(),
    durationSeconds: z.number().int().nullable(),
    plannedDurationMinutes: z.number().int().nullable(),
    attendanceKind: z.enum(["attended", "partial", "absent", "upcoming"]),
  })
  .strict();

export const batchLearnerExamItemSchema = z
  .object({
    assessmentId: z.uuid(),
    assessmentTitle: z.string(),
    attemptId: z.uuid(),
    attemptStatus: z.string(),
    scorePct: z.number().nullable(),
    submittedAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime(),
    durationSeconds: z.number().int().nullable(),
    passMarkPct: z.number().nullable(),
    outcome: z.enum(["passed", "borderline", "failed", "in_progress", "other"]),
  })
  .strict();

export const batchLearnerCourseProgressItemSchema = z
  .object({
    courseId: z.uuid(),
    courseTitle: z.string(),
    completedLessons: z.number().int().nonnegative(),
    totalLessons: z.number().int().nonnegative(),
    completionPct: z.number().int().min(0).max(100),
    lastLessonTitle: z.string().nullable(),
    statusLabel: z.enum(["completed", "in_progress", "behind", "not_started"]),
  })
  .strict();

export const batchLearnerLessonStripItemSchema = z
  .object({
    lessonId: z.uuid(),
    title: z.string(),
    sortOrder: z.number().int(),
    completed: z.boolean(),
    isNext: z.boolean(),
  })
  .strict();

export const batchLearnerDetailResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchKey: z.string(),
    batchName: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    batchStartsAt: z.iso.datetime().nullable(),
    batchEndsAt: z.iso.datetime().nullable(),
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    joinedAt: z.iso.datetime(),
    activityAt: z.iso.datetime().nullable(),
    health: batchHealthSchema,
    summary: z.object({
      liveAttendancePct: z.number().nullable(),
      liveAttendedCount: z.number().int().nonnegative(),
      livePartialCount: z.number().int().nonnegative(),
      liveAbsentCount: z.number().int().nonnegative(),
      liveSessionCount: z.number().int().nonnegative(),
      testScorePct: z.number().nullable(),
      bestTestScorePct: z.number().nullable(),
      testAttemptCount: z.number().int().nonnegative(),
      contentCompletionPct: z.number().int().min(0).max(100),
      completedLessons: z.number().int().nonnegative(),
      totalLessons: z.number().int().nonnegative(),
      daysInBatch: z.number().int().nonnegative(),
      targetDays: z.number().int().nullable(),
      passMarkPct: z.number().nullable(),
      lastActivityLabel: z.string().nullable(),
    }),
    cohortAverages: z.object({
      contentCompletionPct: z.number().nullable(),
      liveAttendancePct: z.number().nullable(),
      testScorePct: z.number().nullable(),
    }),
    standing: z.object({
      completionPercentile: z.number().nullable(),
      testPercentile: z.number().nullable(),
      attendancePercentile: z.number().nullable(),
      completionLabel: z.string(),
      testLabel: z.string(),
      attendanceLabel: z.string(),
    }),
    activityHeatmap: z.object({
      cells: z.array(
        z.object({
          date: z.string(),
          count: z.number().int().nonnegative(),
        }),
      ),
      longestGapDays: z.number().int().nullable(),
    }),
    membership: z.object({
      membershipId: z.uuid(),
      joinedAt: z.iso.datetime(),
      role: z.string(),
      source: z.string(),
      addedBy: z.string(),
    }),
    liveAttendance: z.array(batchLearnerLiveAttendanceItemSchema),
    exams: z.array(batchLearnerExamItemSchema),
    courseProgress: z.array(batchLearnerCourseProgressItemSchema),
    lessonStrip: z.array(batchLearnerLessonStripItemSchema),
  }),
});

export const removeBatchLearnerBodySchema = rejectClientTenantFields
  .extend({
    reason: z.enum(["transferred", "withdrawn", "administrative", "other"]),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const removeBatchLearnerResponseSchema = z.object({
  data: z.object({
    removed: z.boolean(),
    batchId: z.uuid(),
    membershipId: z.uuid(),
  }),
});

export const batchLiveSessionsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["any", "upcoming", "completed", "cancelled", "live"]).default("any"),
    sortBy: z.enum(["scheduled_at", "title", "attendance_rate"]).default("scheduled_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type BatchLiveSessionsQuery = z.output<typeof batchLiveSessionsQuerySchema>;

export const batchLiveSessionItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    kind: z.string().nullable(),
    status: z.string(),
    hostLabel: z.string().nullable(),
    scheduledAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
    plannedDurationMinutes: z.number().int().nullable(),
    actualDurationMinutes: z.number().int().nullable(),
    rosterCount: z.number().int().nonnegative(),
    attendedCount: z.number().int().nonnegative(),
    attendanceRatePct: z.number().nullable(),
    avgWatchMinutes: z.number().nullable(),
    lateCount: z.number().int().nonnegative(),
    recordingUrl: z.string().nullable(),
    hasRecording: z.boolean(),
  })
  .strict();

export const batchLiveSessionsSummarySchema = z.object({
  avgAttendancePct: z.number().nullable(),
  sessionsHeldCount: z.number().int().nonnegative(),
  sessionsTotalCount: z.number().int().nonnegative(),
  perfectAttendanceCount: z.number().int().nonnegative(),
  missedThreeOrMoreCount: z.number().int().nonnegative(),
  avgWatchMinutes: z.number().nullable(),
  plannedWatchMinutes: z.number().nullable(),
  rosterCount: z.number().int().nonnegative(),
});

export const batchLiveSessionsListResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchKey: z.string(),
    batchName: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    items: z.array(batchLiveSessionItemSchema),
    pageInfo: pageInfoSchema,
    summary: batchLiveSessionsSummarySchema,
  }),
});

export const batchLiveSessionsMatrixQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    limitLearners: z.coerce.number().int().min(1).max(200).default(100),
    limitSessions: z.coerce.number().int().min(1).max(60).default(40),
  })
  .strict();

export type BatchLiveSessionsMatrixQuery = z.output<typeof batchLiveSessionsMatrixQuerySchema>;

export const batchLiveSessionsMatrixResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchName: z.string(),
    sessions: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        scheduledAt: z.iso.datetime().nullable(),
        status: z.string(),
      }),
    ),
    learners: z.array(
      z.object({
        membershipId: z.uuid(),
        learnerName: z.string().nullable(),
        email: z.string().nullable(),
        cells: z.array(
          z.object({
            liveSessionId: z.uuid(),
            kind: z.enum(["attended", "partial", "absent", "upcoming", "cancelled", "none"]),
          }),
        ),
        attendedCount: z.number().int().nonnegative(),
        missedCount: z.number().int().nonnegative(),
      }),
    ),
  }),
});

export const batchLiveSessionsAbsenteesQuerySchema = rejectClientTenantFields
  .extend({
    minMissed: z.coerce.number().int().min(1).max(100).default(1),
  })
  .strict();

export type BatchLiveSessionsAbsenteesQuery = z.output<
  typeof batchLiveSessionsAbsenteesQuerySchema
>;

export const batchLiveSessionsAbsenteesResponseSchema = z.object({
  data: z.object({
    membershipIds: z.array(z.uuid()),
  }),
});

export const batchLiveSessionParamsSchema = z
  .object({
    batchId: z.uuid(),
    sessionId: z.uuid(),
  })
  .strict();

export const batchLiveSessionDetailResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchKey: z.string(),
    batchName: z.string(),
    session: z.object({
      id: z.uuid(),
      title: z.string(),
      kind: z.string().nullable(),
      status: z.string(),
      hostLabel: z.string().nullable(),
      scheduledAt: z.iso.datetime().nullable(),
      startedAt: z.iso.datetime().nullable(),
      endedAt: z.iso.datetime().nullable(),
      plannedDurationMinutes: z.number().int().nullable(),
      actualDurationMinutes: z.number().int().nullable(),
      recordingUrl: z.string().nullable(),
      hasRecording: z.boolean(),
      timezoneLabel: z.string().nullable(),
    }),
    nextSession: z
      .object({
        id: z.uuid(),
        title: z.string(),
        scheduledAt: z.iso.datetime().nullable(),
      })
      .nullable(),
    summary: z.object({
      attendancePct: z.number().nullable(),
      attendedCount: z.number().int().nonnegative(),
      rosterCount: z.number().int().nonnegative(),
      absentCount: z.number().int().nonnegative(),
      avgWatchMinutes: z.number().nullable(),
      plannedWatchMinutes: z.number().nullable(),
      lateJoinCount: z.number().int().nonnegative(),
      leftEarlyCount: z.number().int().nonnegative(),
      peakConcurrent: z.number().int().nonnegative().nullable(),
      peakConcurrentAt: z.iso.datetime().nullable(),
      peakConcurrentOffsetMinutes: z.number().int().nullable(),
    }),
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
    rules: z.object({
      attendedMinWatchPct: z.number(),
      partialMinWatchPct: z.number(),
      warningWatchPct: z.number(),
      lateJoinGraceMinutes: z.number(),
    }),
  }),
});

export const batchLiveSessionAttendeesQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    attendanceKind: z
      .enum(["any", "attended", "partial", "absent", "excused", "upcoming"])
      .default("any"),
    sortBy: z
      .enum(["learner_name", "joined_at", "left_at", "watch_pct", "status", "rejoins"])
      .default("status"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type BatchLiveSessionAttendeesQuery = z.output<typeof batchLiveSessionAttendeesQuerySchema>;

export const batchLiveSessionAttendeeItemSchema = z
  .object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    attendanceKind: z.enum(["attended", "partial", "absent", "excused", "upcoming"]),
    healthRail: z.enum(["none", "warning", "danger"]),
    joinedAt: z.iso.datetime().nullable(),
    leftAt: z.iso.datetime().nullable(),
    watchSeconds: z.number().int().nullable(),
    watchMinutes: z.number().nullable(),
    plannedMinutes: z.number().int().nullable(),
    watchPct: z.number().nullable(),
    late: z.boolean(),
    leftEarly: z.boolean(),
    rejoins: z.number().int().nonnegative().nullable(),
    deviceLabel: z.string().nullable(),
  })
  .strict();

export const batchLiveSessionAttendeesListResponseSchema = z.object({
  data: z.object({
    sessionId: z.uuid(),
    sessionTitle: z.string(),
    items: z.array(batchLiveSessionAttendeeItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const batchExamsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    sortBy: z
      .enum(["released_at", "title", "attempted_pct", "avg_score", "pass_rate"])
      .default("released_at"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();

export type BatchExamsQuery = z.output<typeof batchExamsQuerySchema>;

export const batchExamAssessmentItemSchema = z
  .object({
    assessmentId: z.uuid(),
    title: z.string(),
    assessmentType: z.string(),
    typeLabel: z.enum(["exam", "quiz", "other"]),
    releasedAt: z.iso.datetime().nullable(),
    passMarkPct: z.number().nullable(),
    rosterCount: z.number().int().nonnegative(),
    attemptedCount: z.number().int().nonnegative(),
    attemptedPct: z.number().nullable(),
    avgScorePct: z.number().nullable(),
    passRatePct: z.number().nullable(),
    highScorePct: z.number().nullable(),
    lowScorePct: z.number().nullable(),
    awaitingGradingCount: z.number().int().nonnegative(),
    healthRail: z.enum(["none", "success", "warning", "danger"]),
    distribution: z.object({
      min: z.number().nullable(),
      q1: z.number().nullable(),
      median: z.number().nullable(),
      q3: z.number().nullable(),
      max: z.number().nullable(),
    }),
  })
  .strict();

export const batchExamsSummarySchema = z.object({
  avgScorePct: z.number().nullable(),
  passMarkPct: z.number(),
  passRatePct: z.number().nullable(),
  passedLearnerCount: z.number().int().nonnegative(),
  rosterCount: z.number().int().nonnegative(),
  attemptCount: z.number().int().nonnegative(),
  attemptsPerLearner: z.number().nullable(),
  awaitingGradingCount: z.number().int().nonnegative(),
  notAttemptedCount: z.number().int().nonnegative(),
  assessmentCount: z.number().int().nonnegative(),
});

export const batchExamsListResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchKey: z.string(),
    batchName: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    summary: batchExamsSummarySchema,
    assessments: z.array(batchExamAssessmentItemSchema),
  }),
});

export const batchExamsMatrixQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    limitLearners: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export type BatchExamsMatrixQuery = z.output<typeof batchExamsMatrixQuerySchema>;

export const batchExamsMatrixResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchName: z.string(),
    passMarkPct: z.number(),
    assessments: z.array(
      z.object({
        assessmentId: z.uuid(),
        title: z.string(),
        shortTitle: z.string(),
        avgScorePct: z.number().nullable(),
      }),
    ),
    learners: z.array(
      z.object({
        membershipId: z.uuid(),
        learnerName: z.string().nullable(),
        email: z.string().nullable(),
        avgScorePct: z.number().nullable(),
        healthRail: z.enum(["none", "success", "warning", "danger"]),
        cells: z.array(
          z.object({
            assessmentId: z.uuid(),
            kind: z.enum(["passed", "failed", "awaiting", "not_attempted"]),
            scorePct: z.number().nullable(),
            attemptCount: z.number().int().nonnegative(),
          }),
        ),
      }),
    ),
    cohortAvgScorePct: z.number().nullable(),
  }),
});

export const batchExamsBelowPassResponseSchema = z.object({
  data: z.object({
    membershipIds: z.array(z.uuid()),
    passMarkPct: z.number(),
  }),
});

export const batchContentQuerySchema = rejectClientTenantFields.strict();

export type BatchContentQuery = z.output<typeof batchContentQuerySchema>;

export const batchContentLessonTypeSchema = z.enum([
  "video",
  "article",
  "quiz",
  "project",
  "interactive",
  "other",
]);

export const batchContentFunnelLessonSchema = z
  .object({
    lessonId: z.uuid(),
    moduleId: z.uuid(),
    moduleTitle: z.string(),
    modulePosition: z.number().int().nonnegative(),
    lessonPosition: z.number().int().nonnegative(),
    sequenceNumber: z.number().int().positive(),
    title: z.string(),
    lessonType: batchContentLessonTypeSchema,
    typeLabel: z.string(),
    completedCount: z.number().int().nonnegative(),
    rosterCount: z.number().int().nonnegative(),
    completionPct: z.number().nullable(),
    medianDurationSeconds: z.number().nullable(),
    medianDurationLabel: z.string().nullable(),
    dropOffPct: z.number().nullable(),
    healthRail: z.enum(["none", "warning", "danger"]),
  })
  .strict();

export const batchContentSummarySchema = z.object({
  avgCompletionPct: z.number().nullable(),
  avgCompletedLessons: z.number().nullable(),
  totalLessons: z.number().int().nonnegative(),
  finishedCount: z.number().int().nonnegative(),
  stalledCount: z.number().int().nonnegative(),
  neverStartedCount: z.number().int().nonnegative(),
  medianDaysToFinish: z.number().nullable(),
  rosterCount: z.number().int().nonnegative(),
  stalledDaysThreshold: z.number().int().positive(),
  weeksBehindSchedule: z.number().nullable(),
  paceLabel: z.string().nullable(),
});

export const batchContentResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchKey: z.string(),
    batchName: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    summary: batchContentSummarySchema,
    completionSpread: z.object({
      band0to25: z.number().int().nonnegative(),
      band26to50: z.number().int().nonnegative(),
      band51to75: z.number().int().nonnegative(),
      band76to100: z.number().int().nonnegative(),
    }),
    paceSeries: z.array(
      z.object({
        weekLabel: z.string(),
        weekStart: z.iso.datetime(),
        completionPct: z.number().nullable(),
        expectedPct: z.number().nullable(),
      }),
    ),
    modules: z.array(
      z.object({
        moduleId: z.uuid(),
        title: z.string(),
        position: z.number().int().nonnegative(),
        lessons: z.array(batchContentFunnelLessonSchema),
      }),
    ),
  }),
});

export const batchContentLearnersQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    view: z.enum(["any", "stalled", "never_started", "finished", "in_progress"]).default("any"),
    sortBy: z
      .enum(["learner_name", "completion_pct", "days_since", "projected_finish", "last_activity"])
      .default("completion_pct"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type BatchContentLearnersQuery = z.output<typeof batchContentLearnersQuerySchema>;

export const batchContentLearnerItemSchema = z
  .object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    completionPct: z.number().int().min(0).max(100),
    completedLessons: z.number().int().nonnegative(),
    totalLessons: z.number().int().nonnegative(),
    lastLessonTitle: z.string().nullable(),
    lastLessonSequence: z.number().nullable(),
    lastActivityAt: z.iso.datetime().nullable(),
    daysSinceActivity: z.number().int().nullable(),
    projectedFinishAt: z.iso.datetime().nullable(),
    projectedFinishLabel: z.string(),
    willFinishInWindow: z.boolean().nullable(),
    activityStatus: z.enum(["active", "stalled", "never_started", "finished"]),
    healthRail: z.enum(["none", "success", "warning", "danger"]),
  })
  .strict();

export const batchContentLearnersResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    items: z.array(batchContentLearnerItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const batchContentStalledResponseSchema = z.object({
  data: z.object({
    membershipIds: z.array(z.uuid()),
    stalledDaysThreshold: z.number().int().positive(),
  }),
});

export const batchAudienceBodySchema = rejectClientTenantFields
  .extend({
    batchId: z.uuid(),
    membershipIds: z.array(z.uuid()).min(1).max(2000).optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    joinedFrom: z.iso.datetime().optional(),
    joinedTo: z.iso.datetime().optional(),
    minCompletion: z.number().min(0).max(100).optional(),
    maxCompletion: z.number().min(0).max(100).optional(),
  })
  .strict();

export const sendBatchMessageBodySchema = batchAudienceBodySchema
  .extend({
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    audienceLabel: z.string().trim().min(1).max(200).optional(),
    channels: z
      .array(z.enum(["email", "in_app"]))
      .min(1)
      .max(2)
      .default(["email"]),
    excludeMessagedWithinDays: z.coerce.number().int().min(0).max(90).optional(),
    scheduleAt: z.iso.datetime().optional(),
  })
  .strict();

export const sendBatchMessageResponseSchema = z.object({
  data: z.object({
    sendGroupId: z.uuid(),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
    status: z.enum(["sent", "partially_failed", "scheduled", "failed"]),
  }),
});

export const batchMessagesQuerySchema = rejectClientTenantFields
  .extend({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type BatchMessagesQuery = z.output<typeof batchMessagesQuerySchema>;

export const batchMessageHistoryItemSchema = z
  .object({
    sendGroupId: z.string(),
    subject: z.string(),
    audienceLabel: z.string(),
    recipientCount: z.number().int().nonnegative(),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    openedCount: z.number().nullable(),
    clickedCount: z.number().nullable(),
    channels: z.array(z.enum(["email", "in_app"])),
    status: z.enum(["sent", "partially_failed", "scheduled", "failed"]),
    sentAt: z.iso.datetime().nullable(),
    scheduledAt: z.iso.datetime().nullable(),
    sentByLabel: z.string().nullable(),
    isAutomated: z.boolean(),
  })
  .strict();

export const batchMessagesListResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    batchKey: z.string(),
    batchName: z.string(),
    courseId: z.uuid().nullable(),
    courseTitle: z.string().nullable(),
    rosterCount: z.number().int().nonnegative(),
    items: z.array(batchMessageHistoryItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const batchMessageAudienceKeySchema = z.enum([
  "whole_batch",
  "at_risk",
  "missed_last_session",
  "below_pass",
  "stalled",
]);

export const batchMessagesAudiencesResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    audiences: z.array(
      z.object({
        key: batchMessageAudienceKeySchema,
        label: z.string(),
        count: z.number().int().nonnegative(),
        membershipIds: z.array(z.uuid()),
      }),
    ),
  }),
});

export const batchMessageNudgeSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(120),
    triggerKey: z.string().min(1).max(64),
    triggerLabel: z.string().min(1).max(120),
    enabled: z.boolean(),
  })
  .strict();

export const batchMessagesNudgesResponseSchema = z.object({
  data: z.object({
    batchId: z.uuid(),
    nudges: z.array(batchMessageNudgeSchema),
  }),
});

export const updateBatchMessagesNudgesBodySchema = rejectClientTenantFields
  .extend({
    nudges: z.array(batchMessageNudgeSchema).min(1).max(20),
  })
  .strict();

export const retryBatchMessageBodySchema = rejectClientTenantFields
  .extend({
    sendGroupId: z.uuid(),
  })
  .strict();

export const exportBatchRosterBodySchema = rejectClientTenantFields
  .extend({
    batchId: z.uuid().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    joinedFrom: z.iso.datetime().optional(),
    joinedTo: z.iso.datetime().optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportBatchRosterResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

function parseCompareBatchIds(value: unknown): string[] {
  const parts: string[] = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") {
        parts.push(...entry.split(","));
      }
    }
  } else if (typeof value === "string") {
    parts.push(...value.split(","));
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ids.push(trimmed);
  }
  return ids;
}

export const BATCH_COMPARE_NORMALIZE_OPTIONS = ["week_of_batch", "absolute_dates"] as const;

export const batchesCompareQuerySchema = rejectClientTenantFields
  .extend({
    batchIds: z.preprocess(parseCompareBatchIds, z.array(z.uuid()).min(2).max(4)),
    normalize: z.enum(BATCH_COMPARE_NORMALIZE_OPTIONS).default("week_of_batch"),
  })
  .strict();

export type BatchesCompareQuery = z.output<typeof batchesCompareQuerySchema>;

export const batchCompareSpreadSchema = z
  .object({
    band0to25: z.number().int().nonnegative(),
    band26to50: z.number().int().nonnegative(),
    band51to75: z.number().int().nonnegative(),
    band76to100: z.number().int().nonnegative(),
  })
  .strict();

export const batchCompareTrendPointSchema = z
  .object({
    weekIndex: z.number().int().nonnegative(),
    weekLabel: z.string(),
    weekStart: z.iso.datetime().nullable(),
    contentCompletionPct: z.number().nullable(),
  })
  .strict();

export const batchCompareItemSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    status: z.string(),
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    isRunning: z.boolean(),
    currentWeekIndex: z.number().int().nonnegative().nullable(),
    metrics: z
      .object({
        learners: z.number().int().nonnegative(),
        contentCompletionPct: z.number().nullable(),
        liveAttendancePct: z.number().nullable(),
        testScorePct: z.number().nullable(),
        passRatePct: z.number().nullable(),
        activeLast14Days: z.number().int().nonnegative(),
        atRiskLearners: z.number().int().nonnegative(),
        sessionsHeld: z.number().int().nonnegative(),
        avgWatchMinutes: z.number().nullable(),
        medianDaysToFinish: z.number().nullable(),
      })
      .strict(),
    completionSpread: batchCompareSpreadSchema,
    trend: z.array(batchCompareTrendPointSchema),
  })
  .strict();

export const batchesCompareResponseSchema = z.object({
  data: z.object({
    normalize: z.enum(BATCH_COMPARE_NORMALIZE_OPTIONS),
    items: z.array(batchCompareItemSchema).min(2).max(4),
  }),
});
