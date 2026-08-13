import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const POLL_RESPONDENT_COLUMNS = [
  "learner_name",
  "email",
  "option_label",
  "is_correct",
  "responded_at",
] as const;

export type PollRespondentColumn = (typeof POLL_RESPONDENT_COLUMNS)[number];

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

export const pollsListViewSchema = z.enum([
  "all",
  "open",
  "anonymous",
  "quiz",
  "live",
  "standalone",
]);

export type PollsListView = z.output<typeof pollsListViewSchema>;

export const pollsListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
    pollType: z.enum(["yes_no", "multiple_choice"]).optional(),
    view: pollsListViewSchema.default("all"),
    createdFrom: z.iso.datetime().optional(),
    createdTo: z.iso.datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type PollsListQuery = z.output<typeof pollsListQuerySchema>;

export const pollListItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    pollType: z.string(),
    status: z.string(),
    quizMode: z.boolean(),
    allowMultipleAnswers: z.boolean(),
    anonymousVote: z.boolean(),
    resultVisibility: z.string(),
    layout: z.string(),
    durationSeconds: z.number().int().nullable(),
    liveSessionId: z.uuid().nullable(),
    liveSessionTitle: z.string().nullable(),
    closesAt: z.iso.datetime().nullable(),
    isOpen: z.boolean(),
    responseCount: z.number().int().nonnegative(),
    optionCount: z.number().int().nonnegative(),
    participationPct: z.number().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const pollsListSummarySchema = z.object({
  totalResponses: z.number().int().nonnegative(),
  pollCount: z.number().int().nonnegative(),
  avgParticipationPct: z.number().nullable(),
  quizPollCount: z.number().int().nonnegative(),
  avgQuizCorrectPct: z.number().nullable(),
  openNowCount: z.number().int().nonnegative(),
  anonymousCount: z.number().int().nonnegative(),
});

export type PollsListSummary = z.output<typeof pollsListSummarySchema>;

export const pollsListResponseSchema = z.object({
  data: z.object({
    items: z.array(pollListItemSchema),
    pageInfo: pageInfoSchema,
    summary: pollsListSummarySchema,
  }),
});

export const pollIdParamsSchema = z
  .object({
    pollId: z.uuid(),
  })
  .strict();

export const pollOptionParamsSchema = z
  .object({
    pollId: z.uuid(),
    optionId: z.uuid(),
  })
  .strict();

export const pollOptionBreakdownSchema = z
  .object({
    optionId: z.uuid(),
    label: z.string(),
    sortOrder: z.number().int(),
    isCorrect: z.boolean(),
    count: z.number().int().nonnegative(),
    percent: z.number().min(0).max(100),
  })
  .strict();

export const pollTimelinePointSchema = z
  .object({
    offsetSeconds: z.number().nonnegative(),
    responseCount: z.number().int().nonnegative(),
  })
  .strict();

export const pollTimelineEventSchema = z
  .object({
    kind: z.enum(["opened", "half", "closed"]),
    at: z.iso.datetime(),
    label: z.string(),
    detail: z.string().nullable(),
  })
  .strict();

export const pollDetailResponseSchema = z.object({
  data: pollListItemSchema.extend({
    totalResponses: z.number().int().nonnegative(),
    uniqueLearnerCount: z.number().int().nonnegative(),
    eligibleCount: z.number().int().nonnegative().nullable(),
    correctCount: z.number().int().nonnegative().nullable(),
    correctPct: z.number().nullable(),
    medianResponseSeconds: z.number().nullable(),
    openedAt: z.iso.datetime(),
    closedAt: z.iso.datetime().nullable(),
    firstResponseAt: z.iso.datetime().nullable(),
    lastResponseAt: z.iso.datetime().nullable(),
    options: z.array(pollOptionBreakdownSchema),
    respondentsHidden: z.boolean(),
    timeline: z.object({
      bucketSeconds: z.number().positive(),
      durationSeconds: z.number().nonnegative(),
      points: z.array(pollTimelinePointSchema),
      earlySharePct: z.number().nullable(),
      events: z.array(pollTimelineEventSchema),
    }),
  }),
});

export const pollRespondentsQuerySchema = rejectClientTenantFields
  .extend({
    learnerName: z.string().trim().min(1).max(200).optional(),
    optionId: z.uuid().optional(),
    isCorrect: z.enum(["any", "correct", "incorrect"]).default("any"),
    respondedFrom: z.iso.datetime().optional(),
    respondedTo: z.iso.datetime().optional(),
    sortBy: z
      .enum(["responded_at", "learner_name", "option_label", "response_seconds"])
      .default("responded_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(
      (value) => parseColumns(POLL_RESPONDENT_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type PollRespondentsQuery = z.output<typeof pollRespondentsQuerySchema>;

export const pollRespondentItemSchema = z
  .object({
    membershipId: z.uuid().nullable(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    optionId: z.uuid(),
    optionLabel: z.string(),
    isCorrect: z.boolean().nullable(),
    responseSeconds: z.number().nullable(),
    respondedAt: z.iso.datetime(),
  })
  .strict();

export const pollRespondentsListResponseSchema = z.object({
  data: z.object({
    pollId: z.uuid(),
    pollTitle: z.string(),
    anonymousVote: z.boolean(),
    respondentsHidden: z.boolean(),
    items: z.array(pollRespondentItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const exportPollRosterBodySchema = rejectClientTenantFields
  .extend({
    pollId: z.uuid().optional(),
    learnerName: z.string().trim().min(1).max(200).optional(),
    optionId: z.uuid().optional(),
    respondedFrom: z.iso.datetime().optional(),
    respondedTo: z.iso.datetime().optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportPollRosterResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

export const pollOptionSegmentSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percent: z.number().min(0).max(100),
  })
  .strict();

export const pollOptionTimingBucketSchema = z
  .object({
    offsetSeconds: z.number().nonnegative(),
    optionCount: z.number().int().nonnegative(),
    overallCount: z.number().int().nonnegative(),
  })
  .strict();

export const pollOptionDetailResponseSchema = z.object({
  data: z.object({
    pollId: z.uuid(),
    pollTitle: z.string(),
    pollDescription: z.string().nullable(),
    quizMode: z.boolean(),
    anonymousVote: z.boolean(),
    isOpen: z.boolean(),
    openedAt: z.iso.datetime(),
    closedAt: z.iso.datetime().nullable(),
    respondentsHidden: z.boolean(),
    option: pollOptionBreakdownSchema,
    totalResponses: z.number().int().nonnegative(),
    optionCount: z.number().int().nonnegative(),
    rank: z.number().int().positive(),
    votesAheadOfNext: z.number().int().nullable(),
    medianResponseSeconds: z.number().nullable(),
    overallMedianResponseSeconds: z.number().nullable(),
    timingInsight: z.string().nullable(),
    timing: z.object({
      bucketSeconds: z.number().positive(),
      durationSeconds: z.number().nonnegative(),
      buckets: z.array(pollOptionTimingBucketSchema),
    }),
    segments: z.array(pollOptionSegmentSchema),
    siblings: z.array(pollOptionBreakdownSchema),
  }),
});

export type PollOptionDetail = z.output<typeof pollOptionDetailResponseSchema>["data"];

export const pollNonRespondentsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    presence: z.enum(["any", "present", "absent"]).default("any"),
    excludeAbsent: z.coerce.boolean().default(false),
    sortBy: z
      .enum([
        "learner_name",
        "batch_name",
        "presence",
        "watch_seconds",
        "polls_answered",
        "last_response_at",
      ])
      .default("learner_name"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type PollNonRespondentsQuery = z.output<typeof pollNonRespondentsQuerySchema>;

export const pollNonRespondentItemSchema = z
  .object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    presence: z.enum(["present", "absent"]),
    watchSeconds: z.number().int().nonnegative().nullable(),
    pollsAnswered: z.number().int().nonnegative(),
    lastResponseAt: z.iso.datetime().nullable(),
  })
  .strict();

export const pollNonRespondentsSummarySchema = z
  .object({
    audienceKnown: z.boolean(),
    audienceSource: z.enum(["none", "live_session", "batch"]),
    liveSessionId: z.uuid().nullable(),
    liveSessionTitle: z.string().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    pollTitle: z.string(),
    pollIsOpen: z.boolean(),
    anonymousVote: z.boolean(),
    eligibleCount: z.number().int().nonnegative(),
    respondentCount: z.number().int().nonnegative(),
    nonRespondentCount: z.number().int().nonnegative(),
    presentNonRespondentCount: z.number().int().nonnegative(),
    absentNonRespondentCount: z.number().int().nonnegative(),
  })
  .strict();

export const pollNonRespondentsListResponseSchema = z.object({
  data: z.object({
    pollId: z.uuid(),
    summary: pollNonRespondentsSummarySchema,
    items: z.array(pollNonRespondentItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export type PollNonRespondentsSummary = z.output<typeof pollNonRespondentsSummarySchema>;
export type PollNonRespondentItem = z.output<typeof pollNonRespondentItemSchema>;

export const pollLiveExtendBodySchema = rejectClientTenantFields
  .extend({
    seconds: z.coerce.number().int().min(5).max(3600).default(30),
  })
  .strict();

export type PollLiveExtendBody = z.output<typeof pollLiveExtendBodySchema>;

export const pollLiveRecentAnswerSchema = z
  .object({
    membershipId: z.uuid().nullable(),
    learnerName: z.string().nullable(),
    optionId: z.uuid(),
    optionLabel: z.string(),
    respondedAt: z.iso.datetime(),
  })
  .strict();

export const pollLiveMonitorResponseSchema = z.object({
  data: z.object({
    pollId: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    quizMode: z.boolean(),
    anonymousVote: z.boolean(),
    resultVisibility: z.string(),
    isOpen: z.boolean(),
    durationSeconds: z.number().int().nullable(),
    openedAt: z.iso.datetime(),
    closedAt: z.iso.datetime().nullable(),
    closesAt: z.iso.datetime().nullable(),
    liveSessionId: z.uuid().nullable(),
    liveSessionTitle: z.string().nullable(),
    serverNow: z.iso.datetime(),
    secondsRemaining: z.number().nullable(),
    ranForSeconds: z.number().nullable(),
    totalResponses: z.number().int().nonnegative(),
    eligibleCount: z.number().int().nonnegative().nullable(),
    participationPct: z.number().nullable(),
    avgResponseSeconds: z.number().nullable(),
    correctPct: z.number().nullable(),
    recentResponseCount: z.number().int().nonnegative(),
    showCorrectAnswers: z.boolean(),
    options: z.array(pollOptionBreakdownSchema),
    timeline: z.object({
      bucketSeconds: z.number().positive(),
      durationSeconds: z.number().nonnegative(),
      points: z.array(pollTimelinePointSchema),
    }),
    recentAnswers: z.array(pollLiveRecentAnswerSchema),
    events: z.array(pollTimelineEventSchema),
  }),
});

export type PollLiveMonitor = z.output<typeof pollLiveMonitorResponseSchema>["data"];

export const liveSessionIdParamsSchema = z
  .object({
    liveSessionId: z.uuid(),
  })
  .strict();

export const liveSessionPollOptionSchema = pollOptionBreakdownSchema;

export const liveSessionPollBlockSchema = z
  .object({
    pollId: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    quizMode: z.boolean(),
    anonymousVote: z.boolean(),
    isOpen: z.boolean(),
    pollType: z.string(),
    openedAt: z.iso.datetime(),
    closedAt: z.iso.datetime().nullable(),
    responseCount: z.number().int().nonnegative(),
    eligibleCount: z.number().int().nonnegative().nullable(),
    participationPct: z.number().nullable(),
    correctPct: z.number().nullable(),
    options: z.array(liveSessionPollOptionSchema),
  })
  .strict();

export const liveSessionPollTimelineBandSchema = z
  .object({
    pollId: z.uuid(),
    title: z.string(),
    offsetStartSeconds: z.number().nonnegative(),
    offsetEndSeconds: z.number().nonnegative(),
    participationPct: z.number().nullable(),
    responseCount: z.number().int().nonnegative(),
  })
  .strict();

export const liveSessionAttendancePointSchema = z
  .object({
    offsetSeconds: z.number().nonnegative(),
    concurrent: z.number().int().nonnegative(),
  })
  .strict();

export const liveSessionMatrixCellKindSchema = z.enum([
  "answered",
  "missed",
  "correct",
  "incorrect",
  "anonymous",
]);

export const liveSessionPollReportResponseSchema = z.object({
  data: z.object({
    session: z
      .object({
        id: z.uuid(),
        title: z.string(),
        status: z.string(),
        scheduledAt: z.iso.datetime().nullable(),
        startedAt: z.iso.datetime().nullable(),
        endedAt: z.iso.datetime().nullable(),
        durationSeconds: z.number().int().nonnegative().nullable(),
        attendanceCount: z.number().int().nonnegative(),
        hostLabel: z.string().nullable(),
        courseId: z.uuid().nullable(),
        courseTitle: z.string().nullable(),
        batchId: z.uuid().nullable(),
        batchName: z.string().nullable(),
        recordingUrl: z.string().nullable(),
        hasRecording: z.boolean(),
        timezoneLabel: z.string().nullable(),
      })
      .strict(),
    summary: z
      .object({
        pollsRun: z.number().int().nonnegative(),
        opinionCount: z.number().int().nonnegative(),
        quizCount: z.number().int().nonnegative(),
        avgParticipationPct: z.number().nullable(),
        mostAnswered: z
          .object({
            pollId: z.uuid(),
            title: z.string(),
            responseCount: z.number().int().nonnegative(),
          })
          .nullable(),
        leastAnswered: z
          .object({
            pollId: z.uuid(),
            title: z.string(),
            responseCount: z.number().int().nonnegative(),
          })
          .nullable(),
        answeredEveryPollCount: z.number().int().nonnegative(),
      })
      .strict(),
    timeline: z
      .object({
        durationSeconds: z.number().nonnegative(),
        insight: z.string().nullable(),
        attendance: z.object({
          bucketSeconds: z.number().positive(),
          points: z.array(liveSessionAttendancePointSchema),
        }),
        polls: z.array(liveSessionPollTimelineBandSchema),
      })
      .strict(),
    polls: z.array(liveSessionPollBlockSchema),
    matrix: z
      .object({
        polls: z.array(
          z
            .object({
              pollId: z.uuid(),
              title: z.string(),
              openedAt: z.iso.datetime(),
              anonymousVote: z.boolean(),
              quizMode: z.boolean(),
              participationPct: z.number().nullable(),
            })
            .strict(),
        ),
        learners: z.array(
          z
            .object({
              membershipId: z.uuid(),
              learnerName: z.string().nullable(),
              email: z.string().nullable(),
              cells: z.array(
                z
                  .object({
                    pollId: z.uuid(),
                    kind: liveSessionMatrixCellKindSchema,
                  })
                  .strict(),
              ),
              answeredCount: z.number().int().nonnegative(),
              trackedPollCount: z.number().int().nonnegative(),
            })
            .strict(),
        ),
        truncated: z.boolean(),
      })
      .strict(),
  }),
});

export type LiveSessionPollReport = z.output<typeof liveSessionPollReportResponseSchema>["data"];
export type LiveSessionPollBlock = z.output<typeof liveSessionPollBlockSchema>;
export type LiveSessionMatrixCellKind = z.output<typeof liveSessionMatrixCellKindSchema>;

export const liveSessionsPollsListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type LiveSessionsPollsListQuery = z.output<typeof liveSessionsPollsListQuerySchema>;

export const liveSessionPollListItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    status: z.string(),
    scheduledAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
    hostLabel: z.string().nullable(),
    attendanceCount: z.number().int().nonnegative(),
    pollCount: z.number().int().nonnegative(),
    quizPollCount: z.number().int().nonnegative(),
    totalResponses: z.number().int().nonnegative(),
    avgParticipationPct: z.number().nullable(),
    batchId: z.uuid().nullable(),
    batchName: z.string().nullable(),
    courseTitle: z.string().nullable(),
  })
  .strict();

export const liveSessionsPollsListResponseSchema = z.object({
  data: z.object({
    items: z.array(liveSessionPollListItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export type LiveSessionPollListItem = z.output<typeof liveSessionPollListItemSchema>;

function parseComparePollIds(value: unknown): string[] {
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

export const POLL_COMPARE_ALIGN_OPTIONS = ["label", "order"] as const;

export const pollsCompareQuerySchema = rejectClientTenantFields
  .extend({
    pollIds: z.preprocess(parseComparePollIds, z.array(z.uuid()).min(2).max(4)),
    alignBy: z.enum(POLL_COMPARE_ALIGN_OPTIONS).default("label"),
  })
  .strict();

export type PollsCompareQuery = z.output<typeof pollsCompareQuerySchema>;

export const pollCompareOptionCellSchema = z
  .object({
    pollId: z.uuid(),
    optionId: z.uuid().nullable(),
    label: z.string().nullable(),
    count: z.number().int().nonnegative().nullable(),
    percent: z.number().nullable(),
    isCorrect: z.boolean().nullable(),
    deltaPctVsLeft: z.number().nullable(),
  })
  .strict();

export const pollCompareOptionRowSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    cells: z.array(pollCompareOptionCellSchema),
  })
  .strict();

export const pollCompareItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    shortName: z.string(),
    quizMode: z.boolean(),
    anonymousVote: z.boolean(),
    liveSessionId: z.uuid().nullable(),
    liveSessionTitle: z.string().nullable(),
    createdAt: z.iso.datetime(),
    openedAt: z.iso.datetime(),
    closedAt: z.iso.datetime().nullable(),
    responseCount: z.number().int().nonnegative(),
    eligibleCount: z.number().int().nonnegative().nullable(),
    participationPct: z.number().nullable(),
    medianResponseSeconds: z.number().nullable(),
    correctPct: z.number().nullable(),
    earlySharePct: z.number().nullable(),
    nonRespondentCount: z.number().int().nonnegative().nullable(),
    options: z.array(pollOptionBreakdownSchema),
  })
  .strict();

export const pollsCompareResponseSchema = z.object({
  data: z.object({
    alignBy: z.enum(POLL_COMPARE_ALIGN_OPTIONS),
    optionsAligned: z.boolean(),
    polls: z.array(pollCompareItemSchema).min(2).max(4),
    optionRows: z.array(pollCompareOptionRowSchema),
    trendInsight: z.string().nullable(),
  }),
});

export type PollsCompareData = z.output<typeof pollsCompareResponseSchema>["data"];
export type PollCompareItem = z.output<typeof pollCompareItemSchema>;
