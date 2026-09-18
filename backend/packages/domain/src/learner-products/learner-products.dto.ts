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

export const LEARNER_PRODUCT_KINDS = [
  "mock_test",
  "test_series",
  "bundle",
  "subscription_plan",
] as const;

/**
 * Publish-state transitions, expressed as a set.
 *
 * The catalogue screen publishes or archives a multi-row selection, and the
 * only honest way to report that is one request: N single-row calls are N
 * transactions that can half-succeed, leaving the operator to reconcile which
 * of the twenty-five rows moved. A set of one is the single-row case, so this
 * is the only shape needed.
 *
 * Its own body schema — rather than a partial product update — means a publish
 * cannot smuggle in a slug or item-list change.
 */
export const updateLearnerProductStatusBodySchema = rejectClientTenantFields
  .extend({
    productKind: z.enum(LEARNER_PRODUCT_KINDS),
    productIds: z.array(z.uuid()).min(1).max(100),
    status: z.enum(PUBLISH_STATUSES),
  })
  .strict();

export const learnerProductStatusResultSchema = z
  .object({
    /** Products that moved, with the state they came from. */
    updated: z.array(
      z.object({
        id: z.uuid(),
        slug: z.string(),
        previousStatus: z.enum(PUBLISH_STATUSES),
        status: z.enum(PUBLISH_STATUSES),
      }),
    ),
    /**
     * Ids the tenant cannot see, or that were deleted between the operator
     * loading the page and acting on it. Reported rather than thrown: one stale
     * id in a selection of twenty-five should not roll back the other
     * twenty-four.
     */
    missingIds: z.array(z.uuid()),
  })
  .strict();

export const learnerProductStatusResponseSchema = z
  .object({ data: learnerProductStatusResultSchema })
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

/**
 * `title` is resolved from the referenced course / mock test / test series, not
 * stored on the item.
 *
 * A bundle item is a `(kind, refId)` pointer, so the catalogue could only ever
 * render "Course", "Course", "Mock test" — a contents list that says nothing
 * about what is actually in the bundle. `null` is meaningful rather than a
 * loading state: it means the referenced product has been deleted and the
 * bundle now points at nothing, which is exactly the integrity problem an
 * administrator needs to see.
 */
export const bundleItemDtoSchema = z
  .object({
    id: z.uuid(),
    itemKind: z.enum(BUNDLE_ITEM_KINDS),
    refId: z.uuid(),
    position: z.number().int(),
    title: z.string().nullable(),
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
    title: z.string().nullable(),
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

/**
 * Replacing a product's contents.
 *
 * The order of the array *is* the order learners receive, so position is not a
 * client-supplied field here as it is on create. Letting the caller send both a
 * list and a position invites the two to disagree, and "two items at position
 * 3" has no correct rendering.
 *
 * `min(1)`: emptying a bundle that learners are already enrolled in is not an
 * edit, it is a silent revocation. Archive the product instead.
 *
 * `expectedUpdatedAt` is the product's `updatedAt` as the editor loaded it. The
 * contents screen is a full page an operator can sit on for minutes while
 * reordering, which is long enough for a colleague to save first — without this
 * the second save silently discards the first, and neither of them is told.
 * Optional so a scripted caller can opt out of the check deliberately.
 */
export const bundleContentRefSchema = z
  .object({
    itemKind: z.enum(BUNDLE_ITEM_KINDS),
    refId: z.uuid(),
  })
  .strict();

export const replaceBundleContentsBodySchema = rejectClientTenantFields
  .extend({
    expectedUpdatedAt: z.iso.datetime().optional(),
    items: z.array(bundleContentRefSchema).min(1).max(200),
  })
  .strict();

export const subscriptionContentRefSchema = z
  .object({
    itemKind: z.enum(SUBSCRIPTION_ITEM_KINDS),
    refId: z.uuid(),
  })
  .strict();

export const replaceSubscriptionPlanContentsBodySchema = rejectClientTenantFields
  .extend({
    expectedUpdatedAt: z.iso.datetime().optional(),
    items: z.array(subscriptionContentRefSchema).min(1).max(200),
  })
  .strict();

export const testSeriesContentRefSchema = z
  .object({
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

export const replaceTestSeriesContentsBodySchema = rejectClientTenantFields
  .extend({
    expectedUpdatedAt: z.iso.datetime().optional(),
    items: z.array(testSeriesContentRefSchema).min(1).max(200),
  })
  .strict();

/** A mock test's "contents" is the single assessment it wraps. */
export const replaceMockTestContentsBodySchema = rejectClientTenantFields
  .extend({
    expectedUpdatedAt: z.iso.datetime().optional(),
    assessmentId: z.uuid(),
  })
  .strict();

/**
 * Duplicating a product.
 *
 * The copy always lands in DRAFT regardless of the source's state — a duplicate
 * that went straight to PUBLISHED would put an unreviewed product in front of
 * learners on one click, which is why status is not a field here.
 */
export const duplicateLearnerProductBodySchema = rejectClientTenantFields
  .extend({
    slug: z.string().trim().min(1).max(128).optional(),
    title: z.string().trim().min(1).max(512).optional(),
  })
  .strict();

/**
 * Is this slug free, and if not, what is holding it?
 *
 * A 409 on submit tells an operator the slug is taken but not by what, so the
 * only way to find the clash was to go and search the catalogue. The conflict
 * is named here because the unique index is per tenant — the row holding the
 * slug is always one this tenant can already see, so identifying it discloses
 * nothing new.
 */
export const learnerProductSlugCheckQuerySchema = rejectClientTenantFields
  .extend({
    productKind: z.enum(LEARNER_PRODUCT_KINDS),
    slug: z.string().trim().min(1).max(128),
  })
  .strict();

export const learnerProductSlugCheckResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    available: z.boolean(),
    conflict: z
      .object({
        id: z.uuid(),
        title: z.string(),
      })
      .nullable(),
  }),
});

export const ENROLLMENT_STATUSES = ["active", "revoked"] as const;

/**
 * Filters for a product's enrolment roster.
 *
 * `q` matches the learner's display name or account email — the two things an
 * administrator actually knows when someone asks "am I in this?". Matching the
 * membership id too would be free but misleading: a UUID is not something
 * anybody types from memory.
 */
export const productEnrollmentListQuerySchema = rejectClientTenantFields
  .extend({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().min(1).max(256).optional(),
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    enrolledType: z.string().trim().min(1).max(64).optional(),
    enrolledFrom: z.iso.datetime().optional(),
    enrolledTo: z.iso.datetime().optional(),
  })
  .strict();

export const ENROLLMENT_ACTIONS = ["set_expiry", "revoke", "restore"] as const;

/**
 * Bulk changes to a product's enrolments.
 *
 * One command endpoint per selection rather than one request per row, for the
 * same reason the publish bar is batched: twenty-five rows must move together
 * or not at all, and a half-applied expiry change leaves an operator with no
 * way to tell which learners were touched.
 *
 * `revoke` sets status rather than deleting. An enrolment is a record that
 * somebody was granted access, and destroying it destroys the answer to "who
 * gave them that, and when" — which is the whole reason the grant is audited.
 */
export const productEnrollmentActionBodySchema = rejectClientTenantFields
  .extend({
    productKind: z.enum(LEARNER_PRODUCT_KINDS),
    productId: z.uuid(),
    enrollmentIds: z.array(z.uuid()).min(1).max(100),
    action: z.enum(ENROLLMENT_ACTIONS),
    /** Required for `set_expiry`; `null` clears the expiry. */
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.action === "set_expiry" && body.expiresAt === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "set_expiry requires expiresAt (use null to clear it).",
      });
    }
  });

export const productEnrollmentActionResponseSchema = z.object({
  data: z.object({
    updatedIds: z.array(z.uuid()),
    /** Ids no longer on this product — removed or never there. */
    missingIds: z.array(z.uuid()),
  }),
});

/**
 * An enrolment as the admin console shows it.
 *
 * Carries the learner's display name and email alongside the membership id:
 * the console could place a learner into a product but never say who was
 * already in it, and a column of bare UUIDs would not have fixed that.
 */
export const productEnrollmentListItemDtoSchema = z
  .object({
    id: z.uuid(),
    membershipId: z.uuid(),
    displayName: z.string().nullable(),
    email: z.email().nullable(),
    status: z.string(),
    enrolledType: z.string(),
    enrolledAt: z.iso.datetime(),
    expiresAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
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

export const productEnrollmentListResponseSchema = z.object({
  data: z.object({
    items: z.array(productEnrollmentListItemDtoSchema),
    pageInfo: learnerProductListPageInfoSchema,
  }),
});

export type LearnerProductListQuery = z.output<typeof learnerProductListQuerySchema>;
export type CreateMockTestBody = z.output<typeof createMockTestBodySchema>;
export type CreateTestSeriesBody = z.output<typeof createTestSeriesBodySchema>;
export type CreateBundleBody = z.output<typeof createBundleBodySchema>;
export type CreateLearnerSubscriptionPlanBody = z.output<
  typeof createLearnerSubscriptionPlanBodySchema
>;
export type ProductEnrollBody = z.output<typeof productEnrollBodySchema>;
