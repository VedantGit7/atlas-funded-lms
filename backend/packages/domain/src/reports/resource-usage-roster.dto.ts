import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const RESOURCE_USAGE_COLUMNS = [
  "metric_key",
  "metric_label",
  "period",
  "value",
  "unit",
  "calculated_at",
] as const;

export type ResourceUsageColumn = (typeof RESOURCE_USAGE_COLUMNS)[number];

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

export const resourceUsageOverviewPeriodSchema = z
  .enum(["this_month", "last_month", "ytd"])
  .default("this_month");

export type ResourceUsageOverviewPeriod = z.output<typeof resourceUsageOverviewPeriodSchema>;

export const resourceUsageOverviewQuerySchema = rejectClientTenantFields
  .extend({
    period: resourceUsageOverviewPeriodSchema,
  })
  .strict();

export type ResourceUsageOverviewQuery = z.output<typeof resourceUsageOverviewQuerySchema>;

export const resourceUsageOverviewResponseSchema = z.object({
  data: z.object({
    period: resourceUsageOverviewPeriodSchema,
    meters: z.object({
      storageGb: z.number().nonnegative(),
      activeUsers30d: z.number().int().nonnegative(),
      currentMau: z.number().int().nonnegative(),
      totalLearners: z.number().int().nonnegative(),
      testSubmits: z.number().int().nonnegative(),
      products: z.number().int().nonnegative(),
      questions: z.number().int().nonnegative(),
      messageSends: z.number().int().nonnegative(),
      bandwidthGb: z.number().nonnegative(),
      drmTokens: z.number().int().nonnegative(),
      videoTranscodingHours: z.number().nonnegative(),
    }),
    limits: z.object({
      storageGb: z.number().positive().nullable(),
      mau: z.number().positive().nullable(),
    }),
    trends: z.object({
      storageSparkline: z.array(z.number().nonnegative()).max(24),
      storageDeltaGb: z.number(),
      generatedAt: z.iso.datetime(),
    }),
    optimization: z.object({
      dormantContentCount: z.number().int().nonnegative(),
      inactiveLearnerCount: z.number().int().nonnegative(),
      dormantStorageGb: z.number().nonnegative(),
    }),
    notes: z.object({
      bandwidthMetered: z.boolean(),
      drmMetered: z.boolean(),
      videoHoursMetered: z.boolean(),
    }),
    isEmpty: z.boolean(),
  }),
});

export const resourceUsageHistoryQuerySchema = rejectClientTenantFields
  .extend({
    metricKey: z
      .enum([
        "usage.storage_gb",
        "usage.total_learners",
        "usage.products",
        "usage.questions",
        "usage.test_submits",
        "usage.message_sends",
        "usage.email_validations",
      ])
      .optional(),
    rangeMonths: z.coerce.number().int().min(1).max(24).default(24),
    sort: z.enum(["newest", "oldest", "highest_delta"]).default("newest"),
    columns: z.preprocess(
      (value) => parseColumns(RESOURCE_USAGE_COLUMNS, value),
      z.array(z.string().min(1)).min(1),
    ),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ResourceUsageHistoryQuery = z.output<typeof resourceUsageHistoryQuerySchema>;

export const resourceUsageHistoryItemSchema = z
  .object({
    metricKey: z.string(),
    metricLabel: z.string(),
    period: z.string(),
    value: z.number(),
    unit: z.string(),
    previousValue: z.number().nullable(),
    changeAbsolute: z.number().nullable(),
    changePercent: z.number().nullable(),
    calculatedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const resourceUsageHistorySeriesPointSchema = z
  .object({
    period: z.string(),
    value: z.number(),
    changeAbsolute: z.number().nullable(),
  })
  .strict();

export const resourceUsageHistorySeriesSchema = z
  .object({
    metricKey: z.string(),
    metricLabel: z.string(),
    unit: z.string(),
    latestValue: z.number(),
    latestChangeAbsolute: z.number().nullable(),
    points: z.array(resourceUsageHistorySeriesPointSchema).max(24),
  })
  .strict();

export const resourceUsageHistoryMovementSchema = z
  .object({
    metricKey: z.string(),
    metricLabel: z.string(),
    unit: z.string(),
    changeAbsolute: z.number(),
    period: z.string(),
  })
  .strict();

export const resourceUsageHistorySummarySchema = z
  .object({
    totalRecords: z.number().int().nonnegative(),
    metricsTracked: z.number().int().nonnegative(),
    metersAvailable: z.number().int().positive(),
    periodsRecorded: z.number().int().nonnegative(),
    earliestPeriod: z.string().nullable(),
    latestPeriod: z.string().nullable(),
    lastCalculatedAt: z.iso.datetime().nullable(),
    largestMovement: resourceUsageHistoryMovementSchema.nullable(),
    smallestMovement: resourceUsageHistoryMovementSchema.nullable(),
  })
  .strict();

export const resourceUsageHistoryResponseSchema = z.object({
  data: z.object({
    items: z.array(resourceUsageHistoryItemSchema),
    series: z.array(resourceUsageHistorySeriesSchema),
    summary: resourceUsageHistorySummarySchema,
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

const queryBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      if (typeof value === "boolean") return value;
      return value === "true" || value === "1";
    });

export const resourceUsageDormantQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    view: z.enum(["all", "unpublished", "large", "never_opened"]).default("all"),
    status: z.enum(["all", "published", "unpublished", "archived"]).default("all"),
    dormantDays: z.coerce.number().int().min(7).max(365).default(30),
    minLessons: z.coerce.number().int().min(0).max(1000).default(1),
    includeUnpublished: queryBoolean(true),
    includeArchived: queryBoolean(false),
    dormantForMin: z.coerce.number().int().min(0).max(365).optional(),
    storageMinGb: z.coerce.number().min(0).max(1_000_000).optional(),
    enrolmentFilter: z.enum(["any", "zero_active", "has_active"]).default("any"),
    sort: z
      .enum(["storage_desc", "dormant_desc", "title_asc", "activity_asc", "lessons_desc"])
      .default("storage_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ResourceUsageDormantQuery = z.output<typeof resourceUsageDormantQuerySchema>;

export const resourceUsageDormantItemSchema = z
  .object({
    courseId: z.uuid(),
    title: z.string(),
    status: z.string(),
    shortCode: z.string(),
    lessonCount: z.number().int().nonnegative(),
    storageGb: z.number().nonnegative(),
    storageSharePct: z.number().nonnegative(),
    activeEnrolmentCount: z.number().int().nonnegative(),
    inactiveEnrolmentCount: z.number().int().nonnegative(),
    totalEnrolmentCount: z.number().int().nonnegative(),
    lastLearnerActivityAt: z.iso.datetime().nullable(),
    dormantDays: z.number().int().nonnegative(),
    createdAt: z.iso.datetime().nullable(),
    selectable: z.boolean(),
  })
  .strict();

export const resourceUsageDormantSummarySchema = z
  .object({
    dormantCourseCount: z.number().int().nonnegative(),
    totalCourseCount: z.number().int().nonnegative(),
    dormantCoursePct: z.number().nonnegative(),
    storageHeldGb: z.number().nonnegative(),
    storageHeldPct: z.number().nonnegative(),
    totalStorageGb: z.number().nonnegative(),
    unpublishedDormantCount: z.number().int().nonnegative(),
    longestDormantDays: z.number().int().nonnegative().nullable(),
    longestDormantCourseId: z.uuid().nullable(),
    longestDormantTitle: z.string().nullable(),
    longestDormantShortCode: z.string().nullable(),
    lessonsAffected: z.number().int().nonnegative(),
    viewCounts: z.object({
      all: z.number().int().nonnegative(),
      unpublished: z.number().int().nonnegative(),
      large: z.number().int().nonnegative(),
      neverOpened: z.number().int().nonnegative(),
    }),
    settings: z.object({
      dormantDays: z.number().int().positive(),
      minLessons: z.number().int().nonnegative(),
      includeUnpublished: z.boolean(),
      includeArchived: z.boolean(),
    }),
  })
  .strict();

export const resourceUsageDormantResponseSchema = z.object({
  data: z.object({
    summary: resourceUsageDormantSummarySchema,
    items: z.array(resourceUsageDormantItemSchema),
    pageInfo: pageInfoSchema,
    isEmpty: z.boolean(),
  }),
});

export type ResourceUsageDormantResponse = z.output<typeof resourceUsageDormantResponseSchema>;

export const resourceUsageDormantArchiveBodySchema = rejectClientTenantFields
  .extend({
    courseIds: z.array(z.uuid()).min(1).max(50),
    action: z.enum(["archive", "unpublish"]).default("archive"),
    reason: z.enum(["outdated", "consolidated", "low_engagement", "other"]),
    deleteAssets: z.boolean().default(false),
  })
  .strict();

export type ResourceUsageDormantArchiveBody = z.output<
  typeof resourceUsageDormantArchiveBodySchema
>;

export const resourceUsageDormantArchiveResponseSchema = z.object({
  data: z.object({
    action: z.enum(["archive", "unpublish"]),
    processedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    deletedAssetsGb: z.number().nonnegative(),
    courseIds: z.array(z.uuid()),
    skippedCourseIds: z.array(z.uuid()),
  }),
});

export type ResourceUsageDormantArchiveResponse = z.output<
  typeof resourceUsageDormantArchiveResponseSchema
>;

export const resourceUsageDormantCourseParamsSchema = z
  .object({
    courseId: z.uuid(),
  })
  .strict();

export type ResourceUsageDormantCourseParams = z.output<
  typeof resourceUsageDormantCourseParamsSchema
>;

export const resourceUsageDormantCourseQuerySchema = rejectClientTenantFields
  .extend({
    dormantDays: z.coerce.number().int().min(7).max(365).default(30),
  })
  .strict();

export type ResourceUsageDormantCourseQuery = z.output<
  typeof resourceUsageDormantCourseQuerySchema
>;

export const resourceUsageDormantCourseDetailResponseSchema = z.object({
  data: z.object({
    course: z
      .object({
        courseId: z.uuid(),
        title: z.string(),
        status: z.string(),
        shortCode: z.string(),
        dormantDays: z.number().int().nonnegative(),
        neverOpened: z.boolean(),
        createdAt: z.iso.datetime().nullable(),
        selectable: z.boolean(),
        openCourseHref: z.string(),
      })
      .strict(),
    summary: z
      .object({
        storageGb: z.number().nonnegative(),
        storageShareOfTenantPct: z.number().nonnegative(),
        totalTenantStorageGb: z.number().nonnegative(),
        lessonCount: z.number().int().nonnegative(),
        lessonsWithAssetsCount: z.number().int().nonnegative(),
        fileCount: z.number().int().nonnegative(),
        lastLearnerActivityAt: z.iso.datetime().nullable(),
        enrolmentTotal: z.number().int().nonnegative(),
        enrolmentActive: z.number().int().nonnegative(),
        enrolmentActiveIn90d: z.number().int().nonnegative(),
      })
      .strict(),
    composition: z.array(
      z
        .object({
          key: z.string(),
          label: z.string(),
          valueGb: z.number().nonnegative(),
          sharePct: z.number().nonnegative(),
        })
        .strict(),
    ),
    topFiles: z.array(
      z
        .object({
          fileName: z.string(),
          contentType: z.string().nullable(),
          assetTypeKey: z.string(),
          assetTypeLabel: z.string(),
          sizeBytes: z.number().nonnegative(),
          sizeLabel: z.string(),
          lessonId: z.uuid().nullable(),
          lessonTitle: z.string().nullable(),
          uploadedAt: z.iso.datetime().nullable(),
        })
        .strict(),
    ),
    impact: z
      .object({
        lessonCount: z.number().int().nonnegative(),
        enrolmentCount: z.number().int().nonnegative(),
        certificatesRemainValid: z.number().int().nonnegative(),
        storageGbIfDeleted: z.number().nonnegative(),
      })
      .strict(),
    lessons: z.array(
      z
        .object({
          lessonId: z.uuid(),
          position: z.number().int().nonnegative(),
          title: z.string(),
          lessonTypeLabel: z.string(),
          durationLabel: z.string().nullable(),
          storageGb: z.number().nonnegative(),
          neverOpened: z.boolean(),
          lastOpenedAt: z.iso.datetime().nullable(),
        })
        .strict(),
    ),
  }),
});

export type ResourceUsageDormantCourseDetailResponse = z.output<
  typeof resourceUsageDormantCourseDetailResponseSchema
>;

export const resourceUsageInactiveQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    view: z.enum(["all", "never_active", "paid_holding"]).default("all"),
    activityStatus: z.enum(["any", "inactive", "dormant", "never_active"]).default("any"),
    inactiveDays: z.coerce.number().int().min(7).max(730).default(90),
    inactiveForMin: z.coerce.number().int().min(0).max(730).optional(),
    enrolmentFilter: z.enum(["any", "has_enrolments", "zero_enrolments"]).default("any"),
    paidFilter: z.enum(["any", "has_paid", "never_paid"]).default("any"),
    includeInvitedNeverSignedIn: queryBoolean(true),
    excludeActivePaidEnrolment: queryBoolean(false),
    sort: z
      .enum([
        "inactive_desc",
        "inactive_asc",
        "activity_asc",
        "name_asc",
        "enrolments_desc",
        "signed_up_asc",
      ])
      .default("inactive_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ResourceUsageInactiveQuery = z.output<typeof resourceUsageInactiveQuerySchema>;

export const resourceUsageInactiveItemSchema = z
  .object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    status: z.string(),
    activityLabel: z.enum(["inactive", "dormant", "never_active"]),
    enrolmentCount: z.number().int().nonnegative(),
    lastActiveAt: z.iso.datetime().nullable(),
    inactiveDays: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    hasPaid: z.boolean(),
    selectable: z.boolean(),
  })
  .strict();

export const resourceUsageInactiveSummarySchema = z
  .object({
    inactiveLearnerCount: z.number().int().nonnegative(),
    totalLearnerCount: z.number().int().nonnegative(),
    inactiveLearnerPct: z.number().nonnegative(),
    neverActiveCount: z.number().int().nonnegative(),
    inactiveOverYearCount: z.number().int().nonnegative(),
    enrolmentsHeld: z.number().int().nonnegative(),
    paidAmongThem: z.number().int().nonnegative(),
    viewCounts: z
      .object({
        all: z.number().int().nonnegative(),
        neverActive: z.number().int().nonnegative(),
        paidHolding: z.number().int().nonnegative(),
      })
      .strict(),
    settings: z
      .object({
        inactiveDays: z.number().int().nonnegative(),
        includeInvitedNeverSignedIn: z.boolean(),
        excludeActivePaidEnrolment: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const resourceUsageInactiveResponseSchema = z.object({
  data: z.object({
    summary: resourceUsageInactiveSummarySchema,
    items: z.array(resourceUsageInactiveItemSchema),
    pageInfo: pageInfoSchema,
    isEmpty: z.boolean(),
  }),
});

export type ResourceUsageInactiveResponse = z.output<typeof resourceUsageInactiveResponseSchema>;

export const resourceUsageInactiveDeactivateBodySchema = rejectClientTenantFields
  .extend({
    membershipIds: z.array(z.uuid()).min(1).max(200),
    reason: z.enum(["subscription_ended", "course_completed", "inactivity", "violation", "other"]),
    excludePaid: z.boolean().default(true),
  })
  .strict();

export type ResourceUsageInactiveDeactivateBody = z.output<
  typeof resourceUsageInactiveDeactivateBodySchema
>;

export const resourceUsageInactiveDeactivateResponseSchema = z.object({
  data: z.object({
    processedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    excludedPaidCount: z.number().int().nonnegative(),
    membershipIds: z.array(z.uuid()),
    skippedMembershipIds: z.array(z.uuid()),
  }),
});

export type ResourceUsageInactiveDeactivateResponse = z.output<
  typeof resourceUsageInactiveDeactivateResponseSchema
>;

export const resourceUsageInactiveMessageBodySchema = rejectClientTenantFields
  .extend({
    membershipIds: z.array(z.uuid()).min(1).max(500),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    channels: z
      .array(z.enum(["email", "in_app"]))
      .min(1)
      .max(2)
      .default(["email", "in_app"]),
    excludeMessagedWithinDays: z.coerce.number().int().min(0).max(365).default(30),
    sendTestToSelf: z.boolean().default(false),
  })
  .strict();

export type ResourceUsageInactiveMessageBody = z.output<
  typeof resourceUsageInactiveMessageBodySchema
>;

export const resourceUsageInactiveMessageResponseSchema = z.object({
  data: z.object({
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
    excludedRecentCount: z.number().int().nonnegative(),
  }),
});

export type ResourceUsageInactiveMessageResponse = z.output<
  typeof resourceUsageInactiveMessageResponseSchema
>;

export const exportResourceUsageRosterBodySchema = rejectClientTenantFields
  .extend({
    reportTab: z.enum(["history", "dormant", "inactive"]).default("history"),
    metricKey: z.string().min(1).max(100).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    columns: z.array(z.string().min(1)).min(1).max(30).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportResourceUsageRosterResponseSchema = z.object({
  data: z.object({
    runId: z.uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

export const RESOURCE_USAGE_METRIC_KEYS = [
  "usage.storage_gb",
  "usage.total_learners",
  "usage.products",
  "usage.questions",
  "usage.test_submits",
  "usage.message_sends",
  "usage.email_validations",
  "usage.current_mau",
  "usage.active_users_30d",
  "usage.bandwidth_gb",
  "usage.drm_tokens",
  "usage.video_transcoding_hours",
] as const;

export type ResourceUsageMetricKey = (typeof RESOURCE_USAGE_METRIC_KEYS)[number];

export const resourceUsageMetricKeySchema = z.enum(RESOURCE_USAGE_METRIC_KEYS);

export const resourceUsageMetricParamsSchema = z
  .object({
    metricKey: resourceUsageMetricKeySchema,
  })
  .strict();

export type ResourceUsageMetricParams = z.output<typeof resourceUsageMetricParamsSchema>;

export const resourceUsageMetricQuerySchema = rejectClientTenantFields.extend({}).strict();

export type ResourceUsageMetricQuery = z.output<typeof resourceUsageMetricQuerySchema>;

export const resourceUsageMetricPeriodSchema = z
  .object({
    period: z.string(),
    value: z.number(),
    changeAbsolute: z.number().nullable(),
    calculatedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const resourceUsageMetricBreakdownSegmentSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    value: z.number().nonnegative(),
    sharePct: z.number().nonnegative(),
  })
  .strict();

export const resourceUsageMetricContributorSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    value: z.number().nonnegative(),
    unit: z.string(),
    lastUpdatedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const resourceUsageMetricRelatedSchema = z
  .object({
    label: z.string(),
    href: z.string(),
    description: z.string().nullable(),
  })
  .strict();

export const resourceUsageMetricDetailResponseSchema = z.object({
  data: z.object({
    metricKey: resourceUsageMetricKeySchema,
    metricLabel: z.string(),
    unit: z.string(),
    category: z.string(),
    definition: z.string(),
    status: z.enum(["metered", "live", "not_metered"]),
    cadence: z.enum(["monthly", "live", "none"]),
    currentValue: z.number().nullable(),
    previousValue: z.number().nullable(),
    changeAbsolute: z.number().nullable(),
    changePercent: z.number().nullable(),
    previousPeriodLabel: z.string().nullable(),
    calculatedAt: z.iso.datetime().nullable(),
    limit: z.number().positive().nullable(),
    limitPct: z.number().nonnegative().nullable(),
    change12Month: z.number().nullable(),
    avgMonthlyGrowth: z.number().nullable(),
    projectedReachLimitLabel: z.string().nullable(),
    periods: z.array(resourceUsageMetricPeriodSchema).max(36),
    series: z.array(
      z.object({
        period: z.string(),
        value: z.number(),
        changeAbsolute: z.number().nullable(),
      }),
    ),
    breakdown: z
      .object({
        kind: z.enum(["storage_assets", "none"]),
        segments: z.array(resourceUsageMetricBreakdownSegmentSchema),
        contributors: z.array(resourceUsageMetricContributorSchema),
        emptyMessage: z.string().nullable(),
      })
      .nullable(),
    related: z.array(resourceUsageMetricRelatedSchema),
  }),
});

export type ResourceUsageMetricDetailResponse = z.output<
  typeof resourceUsageMetricDetailResponseSchema
>;

export const resourceUsageStorageQuerySchema = rejectClientTenantFields
  .extend({
    assetType: z
      .enum(["video", "documents", "images", "audio", "scorm", "attachments", "backups"])
      .optional(),
    sort: z.enum(["size_desc", "files_desc", "activity_asc", "title_asc"]).default("size_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(12),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ResourceUsageStorageQuery = z.output<typeof resourceUsageStorageQuerySchema>;

export const resourceUsageStorageSegmentSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    valueGb: z.number().nonnegative(),
    sharePct: z.number().nonnegative(),
  })
  .strict();

export const resourceUsageStorageHolderSchema = z
  .object({
    courseId: z.uuid(),
    title: z.string(),
    status: z.string(),
    storageGb: z.number().nonnegative(),
    sharePct: z.number().nonnegative(),
    fileCount: z.number().int().nonnegative(),
    lastLearnerActivityAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime().nullable(),
    dormant: z.boolean(),
  })
  .strict();

export const resourceUsageStorageReclaimSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    storageGb: z.number().nonnegative(),
    href: z.string(),
    actionLabel: z.string(),
  })
  .strict();

export const resourceUsageStorageResponseSchema = z.object({
  data: z.object({
    summary: z.object({
      totalGb: z.number().nonnegative(),
      delta30dGb: z.number(),
      sparkline: z.array(z.number().nonnegative()).max(24),
      limitGb: z.number().positive().nullable(),
      limitPct: z.number().nonnegative().nullable(),
      dormantGb: z.number().nonnegative(),
      dormantPct: z.number().nonnegative(),
      largestCourse: z
        .object({
          courseId: z.uuid(),
          title: z.string(),
          storageGb: z.number().nonnegative(),
        })
        .nullable(),
      avgPerCourseGb: z.number().nonnegative(),
      fileCount: z.number().int().nonnegative(),
      courseCount: z.number().int().nonnegative(),
      dominantTypeLabel: z.string().nullable(),
      dominantTypeSharePct: z.number().nullable(),
    }),
    composition: z.array(resourceUsageStorageSegmentSchema),
    reclaim: z.array(resourceUsageStorageReclaimSchema),
    holders: z.array(resourceUsageStorageHolderSchema),
    pageInfo: pageInfoSchema,
    isEmpty: z.boolean(),
  }),
});

export type ResourceUsageStorageResponse = z.output<typeof resourceUsageStorageResponseSchema>;
