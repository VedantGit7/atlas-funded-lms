import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const CUSTOM_FIELD_ROSTER_BASE_COLUMNS = [
  "learner_name",
  "email",
  "enrollment_count",
  "total_spent_cents",
  "last_active_at",
  "signed_up_at",
  "status",
] as const;

export type CustomFieldRosterBaseColumn = (typeof CUSTOM_FIELD_ROSTER_BASE_COLUMNS)[number];

function parseColumns(value: unknown): string[] {
  const allowedBase = new Set<string>(CUSTOM_FIELD_ROSTER_BASE_COLUMNS);
  const parseOne = (column: string) =>
    allowedBase.has(column) || column.startsWith("cf:");

  if (Array.isArray(value)) {
    const selected = value.filter(
      (column): column is string => typeof column === "string" && parseOne(column),
    );
    return selected.length > 0 ? selected : [...CUSTOM_FIELD_ROSTER_BASE_COLUMNS];
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return [...CUSTOM_FIELD_ROSTER_BASE_COLUMNS];
  }
  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter(parseOne);
  return selected.length > 0 ? selected : [...CUSTOM_FIELD_ROSTER_BASE_COLUMNS];
}

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const customFieldRosterQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
    signedUpFrom: z.string().datetime().optional(),
    signedUpTo: z.string().datetime().optional(),
    minTotalSpentCents: z.coerce.number().int().min(0).optional(),
    maxTotalSpentCents: z.coerce.number().int().min(0).optional(),
    sortBy: z
      .enum(["signed_up_at", "last_active_at", "total_spent_cents", "learner_name"])
      .default("signed_up_at"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    columns: z.preprocess(parseColumns, z.array(z.string().min(1)).min(1)),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type CustomFieldRosterQuery = z.output<typeof customFieldRosterQuerySchema>;

export const customFieldDefinitionColumnSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    label: z.string(),
    fieldType: z.string(),
  })
  .strict();

export const customFieldRosterItemSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    status: z.string(),
    enrollmentCount: z.number().int().nonnegative(),
    totalSpentCents: z.number().int().nonnegative(),
    currency: z.string(),
    lastActiveAt: z.string().datetime().nullable(),
    signedUpAt: z.string().datetime().nullable(),
    customFields: z.record(z.string(), z.string().nullable()),
  })
  .strict();

export const customFieldRosterSummarySchema = z
  .object({
    learnerCount: z.number().int().nonnegative(),
    activeLearnerCount: z.number().int().nonnegative(),
    inactiveLearnerCount: z.number().int().nonnegative(),
    customFieldCount: z.number().int().nonnegative(),
    averageCoveragePct: z.number().nullable(),
    learnersWithAllFieldsFilled: z.number().int().nonnegative(),
    fieldsBelow40Coverage: z.number().int().nonnegative(),
  })
  .strict();

export type CustomFieldRosterSummary = z.output<typeof customFieldRosterSummarySchema>;

export const customFieldRosterListResponseSchema = z.object({
  data: z.object({
    items: z.array(customFieldRosterItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
    fieldDefinitions: z.array(customFieldDefinitionColumnSchema),
    summary: customFieldRosterSummarySchema,
  }),
});

export const customFieldDefinitionsReportResponseSchema = z.object({
  data: z.object({
    items: z.array(customFieldDefinitionColumnSchema),
  }),
});

export const customFieldCatalogueQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    fieldType: z.enum(["text", "number", "boolean", "select", "date"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED", "ALL"]).default("ALL"),
    coverage: z
      .enum(["any", "below_40", "40_80", "above_80", "never_used"])
      .default("any"),
    sortBy: z
      .enum(["coverage_asc", "coverage_desc", "label_asc", "created_desc"])
      .default("coverage_asc"),
  })
  .strict();

export type CustomFieldCatalogueQuery = z.output<typeof customFieldCatalogueQuerySchema>;

export const customFieldCatalogueItemSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    label: z.string(),
    fieldType: z.string(),
    status: z.string(),
    options: z.array(z.string()),
    learnerCount: z.number().int().nonnegative(),
    filledCount: z.number().int().nonnegative(),
    coveragePct: z.number().nullable(),
    distinctValueCount: z.number().int().nonnegative(),
    optionsUsedCount: z.number().int().nonnegative().nullable(),
    unusedOptions: z.array(z.string()),
    mostCommonValue: z.string().nullable(),
    mostCommonSharePct: z.number().nullable(),
    lastUpdatedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const customFieldCatalogueSummarySchema = z
  .object({
    fieldsDefined: z.number().int().nonnegative(),
    activeFieldCount: z.number().int().nonnegative(),
    archivedFieldCount: z.number().int().nonnegative(),
    averageCoveragePct: z.number().nullable(),
    fullyCoveredFieldCount: z.number().int().nonnegative(),
    fieldsBelow40Coverage: z.number().int().nonnegative(),
    neverUsedFieldCount: z.number().int().nonnegative(),
    learnerCount: z.number().int().nonnegative(),
  })
  .strict();

export type CustomFieldCatalogueSummary = z.output<typeof customFieldCatalogueSummarySchema>;
export type CustomFieldCatalogueItem = z.output<typeof customFieldCatalogueItemSchema>;

export const customFieldCatalogueResponseSchema = z.object({
  data: z.object({
    items: z.array(customFieldCatalogueItemSchema),
    summary: customFieldCatalogueSummarySchema,
  }),
});

export const exportCustomFieldRosterBodySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
    signedUpFrom: z.string().datetime().optional(),
    signedUpTo: z.string().datetime().optional(),
    minTotalSpentCents: z.coerce.number().int().min(0).optional(),
    maxTotalSpentCents: z.coerce.number().int().min(0).optional(),
    columns: z.array(z.string().min(1)).min(1).max(50).optional(),
    emailDownloadLink: z.boolean().default(true),
  })
  .strict();

export const exportCustomFieldRosterResponseSchema = z.object({
  data: z.object({
    runId: z.string().uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});

export const sendCustomFieldMessageBodySchema = rejectClientTenantFields
  .extend({
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
    audienceCaption: z.string().trim().min(1).max(500).optional(),
    excludeMessagedWithinDays: z.coerce.number().int().min(0).max(365).optional(),
    membershipIds: z.array(z.string().uuid()).min(1).max(2000).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
    signedUpFrom: z.string().datetime().optional(),
    signedUpTo: z.string().datetime().optional(),
    minTotalSpentCents: z.coerce.number().int().min(0).optional(),
    maxTotalSpentCents: z.coerce.number().int().min(0).optional(),
    segmentId: z.string().uuid().optional(),
    segmentName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const sendCustomFieldMessageResponseSchema = z.object({
  data: z.object({
    campaignId: z.string().min(1).max(80),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
  }),
});

export const createCustomFieldGroupBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().trim().min(1).max(256),
    description: z.string().trim().max(2000).optional(),
    syncType: z.enum(["static", "live"]).optional(),
    criteriaSummary: z.string().trim().max(500).optional(),
    membershipIds: z.array(z.string().uuid()).min(1).max(2000).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
    signedUpFrom: z.string().datetime().optional(),
    signedUpTo: z.string().datetime().optional(),
    minTotalSpentCents: z.coerce.number().int().min(0).optional(),
    maxTotalSpentCents: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const createCustomFieldGroupResponseSchema = z.object({
  data: z.object({
    batchId: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    memberCount: z.number().int().nonnegative(),
  }),
});

const customFieldKeyParam = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/);

export const customFieldDetailParamsSchema = z
  .object({
    fieldKey: customFieldKeyParam,
  })
  .strict();

export type CustomFieldDetailParams = z.output<typeof customFieldDetailParamsSchema>;

export const customFieldDetailQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    /** Exact display value, or the sentinel `missing` for learners with no value. */
    valueFilter: z.string().trim().min(1).max(500).optional(),
    minValue: z.coerce.number().optional(),
    maxValue: z.coerce.number().optional(),
    compareWith: customFieldKeyParam.optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict();

export type CustomFieldDetailQuery = z.output<typeof customFieldDetailQuerySchema>;

export const customFieldDetailFieldSchema = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    label: z.string(),
    fieldType: z.string(),
    status: z.string(),
    options: z.array(z.string()),
    createdAt: z.string().datetime(),
  })
  .strict();

export const customFieldDetailSummarySchema = z
  .object({
    learnerCount: z.number().int().nonnegative(),
    filledCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
    coveragePct: z.number().nullable(),
    distinctValueCount: z.number().int().nonnegative(),
    mostCommonValue: z.string().nullable(),
    mostCommonSharePct: z.number().nullable(),
    lastUpdatedAt: z.string().datetime().nullable(),
  })
  .strict();

export const customFieldDetailSelectOptionSchema = z
  .object({
    value: z.string(),
    count: z.number().int().nonnegative(),
    sharePct: z.number().nullable(),
    unused: z.boolean(),
  })
  .strict();

export const customFieldDetailOrphanSchema = z
  .object({
    value: z.string(),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const customFieldDetailSelectSchema = z
  .object({
    options: z.array(customFieldDetailSelectOptionSchema),
    orphaned: z.array(customFieldDetailOrphanSchema),
    unusedDefinedCount: z.number().int().nonnegative(),
  })
  .strict();

export const customFieldDetailNumberBucketSchema = z
  .object({
    label: z.string(),
    min: z.number(),
    max: z.number(),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const customFieldDetailNumberOutlierSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    value: z.number(),
    zScore: z.number().nullable(),
  })
  .strict();

export const customFieldDetailNumberSchema = z
  .object({
    buckets: z.array(customFieldDetailNumberBucketSchema),
    stats: z.object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      mean: z.number().nullable(),
      median: z.number().nullable(),
      stdDev: z.number().nullable(),
      sum: z.number().nullable(),
    }),
    outliersHigh: z.array(customFieldDetailNumberOutlierSchema),
    outliersLow: z.array(customFieldDetailNumberOutlierSchema),
  })
  .strict();

export const customFieldDetailBooleanTrendPointSchema = z
  .object({
    weekStart: z.string().datetime(),
    yesCount: z.number().int().nonnegative(),
    noCount: z.number().int().nonnegative(),
    yesSharePct: z.number().nullable(),
  })
  .strict();

export const customFieldDetailBooleanSchema = z
  .object({
    yesCount: z.number().int().nonnegative(),
    noCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
    yesSharePct: z.number().nullable(),
    noSharePct: z.number().nullable(),
    missingSharePct: z.number().nullable(),
    trend: z.array(customFieldDetailBooleanTrendPointSchema),
    trendCaption: z.string().nullable(),
  })
  .strict();

export const customFieldDetailTopValueSchema = z
  .object({
    value: z.string(),
    count: z.number().int().nonnegative(),
    sharePct: z.number().nullable(),
  })
  .strict();

export const customFieldDetailTextSchema = z
  .object({
    topValues: z.array(customFieldDetailTopValueSchema),
  })
  .strict();

export const customFieldDetailCrossTabSchema = z
  .object({
    otherField: z.object({
      key: z.string(),
      label: z.string(),
      options: z.array(z.string()),
    }),
    rowValues: z.array(z.string()),
    columnValues: z.array(z.string()),
    cells: z.array(z.array(z.number().int().nonnegative())),
    rowTotals: z.array(z.number().int().nonnegative()),
    columnTotals: z.array(z.number().int().nonnegative()),
    grandTotal: z.number().int().nonnegative(),
    strongestAssociation: z.string().nullable(),
  })
  .strict();

export const customFieldDetailLearnerSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    status: z.string(),
    enrollmentCount: z.number().int().nonnegative(),
    totalSpentCents: z.number().int().nonnegative(),
    currency: z.string(),
    lastActiveAt: z.string().datetime().nullable(),
    signedUpAt: z.string().datetime().nullable(),
    fieldValue: z.string().nullable(),
  })
  .strict();

export const customFieldDetailResponseSchema = z.object({
  data: z.object({
    field: customFieldDetailFieldSchema,
    summary: customFieldDetailSummarySchema,
    neverUsed: z.boolean(),
    select: customFieldDetailSelectSchema.nullable(),
    number: customFieldDetailNumberSchema.nullable(),
    boolean: customFieldDetailBooleanSchema.nullable(),
    text: customFieldDetailTextSchema.nullable(),
    crossTab: customFieldDetailCrossTabSchema.nullable(),
    compareFields: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        fieldType: z.string(),
      }),
    ),
    learners: z.object({
      items: z.array(customFieldDetailLearnerSchema),
      pageInfo: pageInfoSchema,
    }),
  }),
});

export type CustomFieldDetailResponse = z.output<typeof customFieldDetailResponseSchema>;

export const customFieldLearnerParamsSchema = z
  .object({
    membershipId: z.string().uuid(),
  })
  .strict();

export type CustomFieldLearnerParams = z.output<typeof customFieldLearnerParamsSchema>;

export const customFieldLearnerFieldSchema = z
  .object({
    definitionId: z.string().uuid(),
    key: z.string(),
    label: z.string(),
    fieldType: z.string(),
    status: z.string(),
    options: z.array(z.string()),
    value: z.string().nullable(),
    valueJson: z.unknown().nullable(),
    filled: z.boolean(),
    updatedAt: z.string().datetime().nullable(),
    updatedByName: z.string().nullable(),
    auditCaption: z.string(),
  })
  .strict();

export const customFieldLearnerHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    definitionId: z.string().uuid(),
    fieldKey: z.string(),
    fieldLabel: z.string(),
    fieldType: z.string(),
    oldValue: z.string().nullable(),
    newValue: z.string().nullable(),
    changedAt: z.string().datetime(),
    changedByName: z.string().nullable(),
  })
  .strict();

export const customFieldLearnerDetailResponseSchema = z.object({
  data: z.object({
    learner: z.object({
      membershipId: z.string().uuid(),
      learnerName: z.string().nullable(),
      email: z.string().nullable(),
      status: z.string(),
      avatarUrl: z.string().nullable(),
      enrollmentCount: z.number().int().nonnegative(),
      totalSpentCents: z.number().int().nonnegative(),
      currency: z.string(),
      lastActiveAt: z.string().datetime().nullable(),
      signedUpAt: z.string().datetime().nullable(),
    }),
    summary: z.object({
      fieldCount: z.number().int().nonnegative(),
      filledCount: z.number().int().nonnegative(),
      missingCount: z.number().int().nonnegative(),
      completenessPct: z.number().nullable(),
    }),
    fields: z.array(customFieldLearnerFieldSchema),
    history: z.array(customFieldLearnerHistoryItemSchema),
    zeroFieldsDefined: z.boolean(),
    noValuesSet: z.boolean(),
  }),
});

export type CustomFieldLearnerDetailResponse = z.output<
  typeof customFieldLearnerDetailResponseSchema
>;

export const updateCustomFieldLearnerValuesBodySchema = rejectClientTenantFields
  .extend({
    values: z
      .array(
        z
          .object({
            definitionId: z.string().uuid(),
            /** Pass `null` to clear the value. */
            valueJson: z.unknown().nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export type UpdateCustomFieldLearnerValuesBody = z.output<
  typeof updateCustomFieldLearnerValuesBodySchema
>;

export const updateCustomFieldLearnerValuesResponseSchema = z.object({
  data: z.object({
    updatedCount: z.number().int().nonnegative(),
    clearedCount: z.number().int().nonnegative(),
  }),
});

/* ── Cohorts ledger (Screen 7) ─────────────────────────────────────────── */

export const customFieldCohortGroupsQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type CustomFieldCohortGroupsQuery = z.output<typeof customFieldCohortGroupsQuerySchema>;

export const customFieldCohortGroupItemSchema = z
  .object({
    batchId: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    sourceKind: z.enum(["segment", "ad_hoc", "segment_snapshot"]),
    sourceLabel: z.string(),
    segmentId: z.string().uuid().nullable(),
    segmentName: z.string().nullable(),
    criteriaSummary: z.string().nullable(),
    memberCount: z.number().int().nonnegative(),
    syncType: z.enum(["static", "live"]),
    createdAt: z.string().datetime(),
    createdByLabel: z.string().nullable(),
  })
  .strict();

export const customFieldCohortGroupsResponseSchema = z.object({
  data: z.object({
    items: z.array(customFieldCohortGroupItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export type CustomFieldCohortGroupsResponse = z.infer<
  typeof customFieldCohortGroupsResponseSchema
>;

export const customFieldCohortMessagesQuerySchema = rejectClientTenantFields
  .extend({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type CustomFieldCohortMessagesQuery = z.output<
  typeof customFieldCohortMessagesQuerySchema
>;

export const customFieldCohortMessageItemSchema = z
  .object({
    campaignId: z.string().min(1).max(80),
    subject: z.string(),
    audienceCaption: z.string().nullable(),
    sourceKind: z.enum(["segment", "ad_hoc"]),
    sourceLabel: z.string(),
    segmentId: z.string().uuid().nullable(),
    segmentName: z.string().nullable(),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    openedCount: z.number().int().nonnegative().nullable(),
    clickedCount: z.number().int().nonnegative().nullable(),
    recipientCount: z.number().int().nonnegative(),
    status: z.enum(["sent", "partially_failed", "failed"]),
    sentByLabel: z.string().nullable(),
    sentAt: z.string().datetime(),
    reportHref: z.string().nullable(),
  })
  .strict();

export const customFieldCohortMessagesResponseSchema = z.object({
  data: z.object({
    items: z.array(customFieldCohortMessageItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export type CustomFieldCohortMessagesResponse = z.infer<
  typeof customFieldCohortMessagesResponseSchema
>;

export const retryCustomFieldCohortMessageParamsSchema = z
  .object({
    campaignId: z.string().min(1).max(80),
  })
  .strict();

export type RetryCustomFieldCohortMessageParams = z.output<
  typeof retryCustomFieldCohortMessageParamsSchema
>;

export const retryCustomFieldCohortMessageBodySchema = rejectClientTenantFields
  .extend({})
  .strict();

export type RetryCustomFieldCohortMessageBody = z.output<
  typeof retryCustomFieldCohortMessageBodySchema
>;

export const retryCustomFieldCohortMessageResponseSchema = z.object({
  data: z.object({
    campaignId: z.string().min(1).max(80),
    deliveredCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(),
  }),
});

