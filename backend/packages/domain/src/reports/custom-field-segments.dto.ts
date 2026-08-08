import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const SEGMENT_LEARNER_FIELD_KEYS = [
  "learner_name",
  "email",
  "enrollment_count",
  "total_spent_cents",
  "last_active_at",
  "signed_up_at",
  "status",
] as const;

export type SegmentLearnerFieldKey = (typeof SEGMENT_LEARNER_FIELD_KEYS)[number];

export const SEGMENT_TEXT_OPERATORS = [
  "is",
  "is_not",
  "contains",
  "starts_with",
  "is_empty",
  "is_not_empty",
] as const;

export const SEGMENT_NUMBER_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "lt",
  "between",
  "is_empty",
] as const;

export const SEGMENT_BOOLEAN_OPERATORS = ["is_true", "is_false", "is_empty"] as const;

export const SEGMENT_SELECT_OPERATORS = [
  "is",
  "is_not",
  "is_any_of",
  "is_none_of",
  "is_empty",
] as const;

export const SEGMENT_DATE_OPERATORS = [
  "before",
  "after",
  "between",
  "in_last_n_days",
  "is_empty",
] as const;

export const segmentConditionOperatorSchema = z.enum([
  ...SEGMENT_TEXT_OPERATORS,
  ...SEGMENT_NUMBER_OPERATORS,
  ...SEGMENT_BOOLEAN_OPERATORS,
  ...SEGMENT_SELECT_OPERATORS,
  ...SEGMENT_DATE_OPERATORS,
]);

export type SegmentConditionOperator = z.output<typeof segmentConditionOperatorSchema>;

export const segmentConditionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.tuple([z.number(), z.number()]),
  z.tuple([z.string(), z.string()]),
  z.object({ days: z.number().int().positive().max(3650) }).strict(),
  z.null(),
]);

export const segmentConditionSchema = z
  .object({
    id: z.string().min(1).max(64),
    fieldSource: z.enum(["learner", "custom"]),
    fieldKey: z.string().trim().min(1).max(120),
    operator: segmentConditionOperatorSchema,
    value: segmentConditionValueSchema.optional().nullable(),
  })
  .strict();

export type SegmentCondition = z.output<typeof segmentConditionSchema>;

export const segmentConditionGroupSchema = z
  .object({
    id: z.string().min(1).max(64),
    combinator: z.enum(["and", "or"]),
    conditions: z.array(segmentConditionSchema).min(1).max(40),
  })
  .strict();

export type SegmentConditionGroup = z.output<typeof segmentConditionGroupSchema>;

export const segmentConditionsTreeSchema = z
  .object({
    rootCombinator: z.enum(["and", "or"]),
    groups: z.array(segmentConditionGroupSchema).min(1).max(20),
  })
  .strict();

export type SegmentConditionsTree = z.output<typeof segmentConditionsTreeSchema>;

export const createCustomFieldSegmentBodySchema = rejectClientTenantFields
  .extend({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional().nullable(),
    visibility: z.enum(["shared", "private"]).default("shared"),
    refreshMode: z.enum(["live", "snapshot"]).default("live"),
    conditions: segmentConditionsTreeSchema,
  })
  .strict();

export type CreateCustomFieldSegmentBody = z.output<typeof createCustomFieldSegmentBodySchema>;

export const updateCustomFieldSegmentBodySchema = rejectClientTenantFields
  .extend({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    visibility: z.enum(["shared", "private"]).optional(),
    refreshMode: z.enum(["live", "snapshot"]).optional(),
    conditions: segmentConditionsTreeSchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.name !== undefined ||
      body.description !== undefined ||
      body.visibility !== undefined ||
      body.refreshMode !== undefined ||
      body.conditions !== undefined,
    { message: "At least one field is required" },
  );

export type UpdateCustomFieldSegmentBody = z.output<typeof updateCustomFieldSegmentBodySchema>;

export const previewCustomFieldSegmentBodySchema = rejectClientTenantFields
  .extend({
    conditions: segmentConditionsTreeSchema,
    limit: z.coerce.number().int().min(1).max(25).default(6),
  })
  .strict();

export type PreviewCustomFieldSegmentBody = z.output<typeof previewCustomFieldSegmentBodySchema>;

export const customFieldSegmentParamsSchema = z
  .object({
    segmentId: z.string().uuid(),
  })
  .strict();

export type CustomFieldSegmentParams = z.output<typeof customFieldSegmentParamsSchema>;

export const createSegmentGroupBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

export type CreateSegmentGroupBody = z.output<typeof createSegmentGroupBodySchema>;

export const customFieldSegmentItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    visibility: z.enum(["shared", "private"]),
    refreshMode: z.enum(["live", "snapshot"]),
    conditions: segmentConditionsTreeSchema,
    conditionSummary: z.string(),
    conditionCount: z.number().int().nonnegative(),
    groupCount: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative().nullable(),
    previousMatchedCount: z.number().int().nonnegative().nullable(),
    matchedDelta: z.number().int().nullable(),
    matchedCountAt: z.string().datetime().nullable(),
    isStale: z.boolean(),
    createdByMembershipId: z.string().uuid(),
    createdByName: z.string().nullable(),
    dependencyCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type CustomFieldSegmentItem = z.output<typeof customFieldSegmentItemSchema>;

export const customFieldSegmentSummarySchema = z
  .object({
    segmentCount: z.number().int().nonnegative(),
    sharedCount: z.number().int().nonnegative(),
    privateCount: z.number().int().nonnegative(),
    learnersCovered: z.number().int().nonnegative(),
    largestSegmentName: z.string().nullable(),
    largestSegmentCount: z.number().int().nonnegative().nullable(),
    staleCount: z.number().int().nonnegative(),
    usedInMessages: z.number().int().nonnegative(),
  })
  .strict();

export type CustomFieldSegmentSummary = z.output<typeof customFieldSegmentSummarySchema>;

export const customFieldSegmentListResponseSchema = z.object({
  data: z.object({
    items: z.array(customFieldSegmentItemSchema),
    summary: customFieldSegmentSummarySchema,
  }),
});

export type CustomFieldSegmentListResponse = z.output<typeof customFieldSegmentListResponseSchema>;

export const customFieldSegmentDetailResponseSchema = z.object({
  data: customFieldSegmentItemSchema,
});

export type CustomFieldSegmentDetailResponse = z.output<
  typeof customFieldSegmentDetailResponseSchema
>;

export const customFieldSegmentFieldDivergenceBucketSchema = z
  .object({
    value: z.string(),
    segmentPct: z.number(),
    tenantPct: z.number(),
  })
  .strict();

export const customFieldSegmentFieldDivergenceSchema = z
  .object({
    fieldKey: z.string(),
    fieldLabel: z.string(),
    fieldType: z.string(),
    caption: z.string(),
    maxDivergencePct: z.number(),
    buckets: z.array(customFieldSegmentFieldDivergenceBucketSchema),
  })
  .strict();

export const customFieldSegmentOverlapItemSchema = z
  .object({
    segmentId: z.string().uuid(),
    name: z.string(),
    overlapCount: z.number().int().nonnegative(),
    overlapPct: z.number(),
  })
  .strict();

export const customFieldSegmentAnalyticsSchema = z
  .object({
    matchedCount: z.number().int().nonnegative(),
    previousMatchedCount: z.number().int().nonnegative().nullable(),
    matchedDelta: z.number().int().nullable(),
    matchedCountAt: z.string().datetime().nullable(),
    totalLearnerCount: z.number().int().nonnegative(),
    shareOfLearnersPct: z.number().nullable(),
    averageTotalSpentCents: z.number().nullable(),
    currency: z.string(),
    averageEnrollmentCount: z.number().nullable(),
    activeLast30DaysCount: z.number().int().nonnegative(),
    activeLast30DaysPct: z.number().nullable(),
    spendHistogram: z.array(
      z.object({
        label: z.string(),
        count: z.number().int().nonnegative(),
        heightPct: z.number(),
      }),
    ),
    tenantMedianSpentCents: z.number().nullable(),
    tenantMedianBucketIndex: z.number().int().nullable(),
    signupCohorts: z.array(
      z.object({
        label: z.string(),
        count: z.number().int().nonnegative(),
        pct: z.number(),
      }),
    ),
    fieldDivergences: z.array(customFieldSegmentFieldDivergenceSchema),
    similarFieldCount: z.number().int().nonnegative(),
    overlaps: z.array(customFieldSegmentOverlapItemSchema),
  })
  .strict();

export type CustomFieldSegmentAnalytics = z.output<typeof customFieldSegmentAnalyticsSchema>;

export const customFieldSegmentViewResponseSchema = z.object({
  data: z.object({
    segment: customFieldSegmentItemSchema,
    analytics: customFieldSegmentAnalyticsSchema,
    zeroMatch: z.boolean(),
  }),
});

export type CustomFieldSegmentViewResponse = z.output<typeof customFieldSegmentViewResponseSchema>;

export const customFieldSegmentLearnersQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type CustomFieldSegmentLearnersQuery = z.output<
  typeof customFieldSegmentLearnersQuerySchema
>;

export const customFieldSegmentLearnerSchema = z
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

export const customFieldSegmentLearnersResponseSchema = z.object({
  data: z.object({
    items: z.array(customFieldSegmentLearnerSchema),
    pageInfo: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      totalCount: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNextPage: z.boolean(),
      hasPreviousPage: z.boolean(),
    }),
    fieldDefinitions: z.array(
      z.object({
        id: z.string().uuid(),
        key: z.string(),
        label: z.string(),
        fieldType: z.string(),
      }),
    ),
  }),
});

export type CustomFieldSegmentLearnersResponse = z.output<
  typeof customFieldSegmentLearnersResponseSchema
>;

export const customFieldSegmentLearnersExportResponseSchema = z.object({
  data: z.object({
    csv: z.string(),
    filename: z.string(),
    rowCount: z.number().int().nonnegative(),
  }),
});

export const customFieldSegmentMutationResponseSchema = z.object({
  data: customFieldSegmentItemSchema,
});

export type CustomFieldSegmentMutationResponse = z.output<
  typeof customFieldSegmentMutationResponseSchema
>;

export const customFieldSegmentPreviewLearnerSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
  })
  .strict();

export const customFieldSegmentPreviewResponseSchema = z.object({
  data: z.object({
    matchedCount: z.number().int().nonnegative(),
    incomplete: z.boolean(),
    incompleteMessage: z.string().nullable(),
    learners: z.array(customFieldSegmentPreviewLearnerSchema),
  }),
});

export type CustomFieldSegmentPreviewResponse = z.output<
  typeof customFieldSegmentPreviewResponseSchema
>;

export const customFieldSegmentDeleteResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export const customFieldSegmentGroupResponseSchema = z.object({
  data: z.object({
    batchId: z.string().uuid(),
    key: z.string(),
    name: z.string(),
    memberCount: z.number().int().nonnegative(),
  }),
});

export const customFieldSegmentExportResponseSchema = z.object({
  data: z.object({
    csv: z.string(),
    filename: z.string(),
    rowCount: z.number().int().nonnegative(),
  }),
});
