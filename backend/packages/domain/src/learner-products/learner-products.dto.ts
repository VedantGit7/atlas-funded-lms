import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const PUBLISH_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const BUNDLE_ITEM_KINDS = ["course", "mock_test", "test_series"] as const;
export const SUBSCRIPTION_ITEM_KINDS = ["course", "mock_test", "test_series", "bundle"] as const;
export const BILLING_INTERVALS = ["monthly", "yearly", "custom"] as const;

export const learnerProductListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(256).optional(),
    status: z.enum(PUBLISH_STATUSES).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const createMockTestBodySchema = rejectClientTenantFields
  .extend({
    slug: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(512),
    description: z.string().trim().max(4096).optional(),
    assessmentId: z.uuid(),
    status: z.enum(PUBLISH_STATUSES).default("DRAFT"),
  })
  .strict();

export const testSeriesItemBodySchema = z
  .object({
    position: z.number().int().min(0),
    title: z.string().trim().min(1).max(512).optional(),
    mockTestId: z.uuid().optional(),
    assessmentId: z.uuid().optional(),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (!item.mockTestId && !item.assessmentId) {
      ctx.addIssue({
        code: "custom",
        message: "Each test series item must include mockTestId or assessmentId.",
      });
    }
  });

export const createTestSeriesBodySchema = rejectClientTenantFields
  .extend({
    slug: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(512),
    description: z.string().trim().max(4096).optional(),
    status: z.enum(PUBLISH_STATUSES).default("DRAFT"),
    items: z.array(testSeriesItemBodySchema).min(1),
  })
  .strict();

export const bundleItemBodySchema = z
  .object({
    itemKind: z.enum(BUNDLE_ITEM_KINDS),
    refId: z.uuid(),
    position: z.number().int().min(0),
  })
  .strict();

export const createBundleBodySchema = rejectClientTenantFields
  .extend({
    slug: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(512),
    description: z.string().trim().max(4096).optional(),
    status: z.enum(PUBLISH_STATUSES).default("DRAFT"),
    items: z.array(bundleItemBodySchema).min(1),
  })
  .strict();

export const subscriptionPlanItemBodySchema = z
  .object({
    itemKind: z.enum(SUBSCRIPTION_ITEM_KINDS),
    refId: z.uuid(),
    position: z.number().int().min(0),
  })
  .strict();

export const createLearnerSubscriptionPlanBodySchema = rejectClientTenantFields
  .extend({
    slug: z.string().trim().min(1).max(128),
    title: z.string().trim().min(1).max(512),
    description: z.string().trim().max(4096).optional(),
    billingInterval: z.enum(BILLING_INTERVALS).default("monthly"),
    status: z.enum(PUBLISH_STATUSES).default("DRAFT"),
    items: z.array(subscriptionPlanItemBodySchema).min(1),
  })
  .strict();

export const productEnrollBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.uuid(),
    enrolledType: z.string().trim().min(1).max(64).default("free"),
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();

export const mockTestParamsSchema = z.object({ mockTestId: z.uuid() }).strict();
export const testSeriesParamsSchema = z.object({ testSeriesId: z.uuid() }).strict();
export const bundleParamsSchema = z.object({ bundleId: z.uuid() }).strict();
export const learnerSubscriptionPlanParamsSchema = z.object({ planId: z.uuid() }).strict();

export const mockTestDtoSchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    assessmentId: z.uuid(),
    status: z.enum(PUBLISH_STATUSES),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const testSeriesItemDtoSchema = z
  .object({
    id: z.uuid(),
    position: z.number().int(),
    title: z.string().nullable(),
    mockTestId: z.uuid().nullable(),
    assessmentId: z.uuid().nullable(),
  })
  .strict();

export const testSeriesDtoSchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(PUBLISH_STATUSES),
    items: z.array(testSeriesItemDtoSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const bundleItemDtoSchema = z
  .object({
    id: z.uuid(),
    itemKind: z.enum(BUNDLE_ITEM_KINDS),
    refId: z.uuid(),
    position: z.number().int(),
  })
  .strict();

export const bundleDtoSchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(PUBLISH_STATUSES),
    items: z.array(bundleItemDtoSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const learnerSubscriptionPlanItemDtoSchema = z
  .object({
    id: z.uuid(),
    itemKind: z.enum(SUBSCRIPTION_ITEM_KINDS),
    refId: z.uuid(),
    position: z.number().int(),
  })
  .strict();

export const learnerSubscriptionPlanDtoSchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    billingInterval: z.enum(BILLING_INTERVALS),
    status: z.enum(PUBLISH_STATUSES),
    items: z.array(learnerSubscriptionPlanItemDtoSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const productEnrollmentDtoSchema = z
  .object({
    id: z.uuid(),
    membershipId: z.uuid(),
    status: z.string(),
    enrolledType: z.string(),
    enrolledAt: z.iso.datetime(),
    expiresAt: z.iso.datetime().nullable(),
  })
  .strict();

export const learnerProductListPageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const mockTestResponseSchema = z.object({ data: mockTestDtoSchema });
export const mockTestListResponseSchema = z.object({
  data: z.object({
    items: z.array(mockTestDtoSchema),
    pageInfo: learnerProductListPageInfoSchema,
  }),
});

export const testSeriesResponseSchema = z.object({ data: testSeriesDtoSchema });
export const testSeriesListResponseSchema = z.object({
  data: z.object({
    items: z.array(testSeriesDtoSchema),
    pageInfo: learnerProductListPageInfoSchema,
  }),
});

export const bundleResponseSchema = z.object({ data: bundleDtoSchema });
export const bundleListResponseSchema = z.object({
  data: z.object({
    items: z.array(bundleDtoSchema),
    pageInfo: learnerProductListPageInfoSchema,
  }),
});

export const learnerSubscriptionPlanResponseSchema = z.object({
  data: learnerSubscriptionPlanDtoSchema,
});
export const learnerSubscriptionPlanListResponseSchema = z.object({
  data: z.object({
    items: z.array(learnerSubscriptionPlanDtoSchema),
    pageInfo: learnerProductListPageInfoSchema,
  }),
});

export const productEnrollmentResponseSchema = z.object({ data: productEnrollmentDtoSchema });

export type LearnerProductListQuery = z.output<typeof learnerProductListQuerySchema>;
export type CreateMockTestBody = z.output<typeof createMockTestBodySchema>;
export type CreateTestSeriesBody = z.output<typeof createTestSeriesBodySchema>;
export type CreateBundleBody = z.output<typeof createBundleBodySchema>;
export type CreateLearnerSubscriptionPlanBody = z.output<
  typeof createLearnerSubscriptionPlanBodySchema
>;
export type ProductEnrollBody = z.output<typeof productEnrollBodySchema>;
