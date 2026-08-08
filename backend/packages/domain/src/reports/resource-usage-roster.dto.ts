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

export const resourceUsageOverviewResponseSchema = z.object({
  data: z.object({
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
    calculatedAt: z.string().datetime().nullable(),
  })
  .strict();

export const resourceUsageHistoryResponseSchema = z.object({
  data: z.object({
    items: z.array(resourceUsageHistoryItemSchema),
    pageInfo: pageInfoSchema,
    columns: z.array(z.string()),
  }),
});

export const resourceUsageDormantQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ResourceUsageDormantQuery = z.output<typeof resourceUsageDormantQuerySchema>;

export const resourceUsageDormantItemSchema = z
  .object({
    courseId: z.string().uuid(),
    title: z.string(),
    status: z.string(),
    lessonCount: z.number().int().nonnegative(),
    storageGb: z.number().nonnegative(),
    lastLearnerActivityAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime().nullable(),
  })
  .strict();

export const resourceUsageDormantResponseSchema = z.object({
  data: z.object({
    items: z.array(resourceUsageDormantItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const resourceUsageInactiveQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ResourceUsageInactiveQuery = z.output<typeof resourceUsageInactiveQuerySchema>;

export const resourceUsageInactiveItemSchema = z
  .object({
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    status: z.string(),
    lastActiveAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const resourceUsageInactiveResponseSchema = z.object({
  data: z.object({
    items: z.array(resourceUsageInactiveItemSchema),
    pageInfo: pageInfoSchema,
  }),
});

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
    runId: z.string().uuid(),
    status: z.string(),
    emailed: z.boolean(),
  }),
});
