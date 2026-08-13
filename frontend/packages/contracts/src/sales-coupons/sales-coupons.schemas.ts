import { z } from "zod";

export const couponStatusSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE"]);
export const couponDiscountTypeSchema = z.enum(["PERCENT", "FIXED"]);
export const couponVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const couponDeviceTypeSchema = z.enum(["ALL", "WEB", "MOBILE"]);

export const couponCourseDtoSchema = z.object({
  courseId: z.uuid(),
  title: z.string().nullable().optional(),
});

export const couponDtoSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: couponStatusSchema,
  discountType: couponDiscountTypeSchema,
  discountValue: z.number().int().positive(),
  maxDiscountCents: z.number().int().positive().nullable(),
  currency: z.string().length(3),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  totalUsageLimit: z.number().int().positive().nullable(),
  perLearnerLimit: z.number().int().positive(),
  minPurchaseCents: z.number().int().nonnegative().nullable(),
  visibility: couponVisibilitySchema,
  deviceType: couponDeviceTypeSchema,
  appliesToAllCourses: z.boolean(),
  courseIds: z.array(z.uuid()),
  courseCount: z.number().int().nonnegative(),
  redemptionCount: z.number().int().nonnegative(),
  activatedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const couponsListSummarySchema = z.object({
  activeCount: z.number().int().nonnegative(),
  draftCount: z.number().int().nonnegative(),
  inactiveCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  totalRedemptions: z.number().int().nonnegative(),
  totalDiscountCents: z.number().int().nonnegative(),
  totalRevenueCents: z.number().int().nonnegative(),
});

export const couponsListQuerySchema = z
  .object({
    status: z.enum(["ALL", "DRAFT", "ACTIVE", "INACTIVE"]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const couponsListResponseSchema = z.object({
  data: z.object({
    items: z.array(couponDtoSchema),
    summary: couponsListSummarySchema,
  }),
});

export const couponResponseSchema = z.object({ data: couponDtoSchema });

const couponCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Coupon code may only contain letters, numbers, _ and -.");

export const createCouponBodySchema = z
  .object({
    code: couponCodeSchema,
    name: z.string().trim().min(1).max(200),
    discountType: couponDiscountTypeSchema,
    discountValue: z.number().int().positive(),
    maxDiscountCents: z.number().int().positive().optional().nullable(),
    currency: z.string().trim().length(3).optional().default("USD"),
    startsAt: z.iso.datetime().optional().nullable(),
    endsAt: z.iso.datetime().optional().nullable(),
    totalUsageLimit: z.number().int().positive().optional().nullable(),
    perLearnerLimit: z.number().int().positive().optional().default(1),
    minPurchaseCents: z.number().int().nonnegative().optional().nullable(),
    visibility: couponVisibilitySchema.optional().default("PRIVATE"),
    deviceType: couponDeviceTypeSchema.optional().default("ALL"),
    appliesToAllCourses: z.boolean().optional().default(true),
    courseIds: z.array(z.uuid()).max(200).optional().default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.discountType === "PERCENT" && value.discountValue > 100) {
      ctx.addIssue({
        code: "custom",
        message: "Percentage discount cannot exceed 100.",
        path: ["discountValue"],
      });
    }
    if (value.totalUsageLimit != null && value.perLearnerLimit > value.totalUsageLimit) {
      ctx.addIssue({
        code: "custom",
        message: "Per-learner limit cannot exceed total usage limit.",
        path: ["perLearnerLimit"],
      });
    }
    if (!value.appliesToAllCourses && value.courseIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one course when not applying to all courses.",
        path: ["courseIds"],
      });
    }
  });

export const createBulkCouponsBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    prefix: z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[A-Za-z0-9_-]+$/, "Prefix may only contain letters, numbers, _ and -."),
    count: z.number().int().min(1).max(100),
    discountType: couponDiscountTypeSchema,
    discountValue: z.number().int().positive(),
    maxDiscountCents: z.number().int().positive().optional().nullable(),
    currency: z.string().trim().length(3).optional().default("USD"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.discountType === "PERCENT" && value.discountValue > 100) {
      ctx.addIssue({
        code: "custom",
        message: "Percentage discount cannot exceed 100.",
        path: ["discountValue"],
      });
    }
  });

export const createBulkCouponsResponseSchema = z.object({
  data: z.object({
    createdCount: z.number().int().nonnegative(),
    items: z.array(couponDtoSchema),
  }),
});

export const updateCouponBodySchema = createCouponBodySchema;

export const deleteCouponBodySchema = z
  .object({ nameConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteCouponResponseSchema = z.object({
  data: z.object({ id: z.uuid(), deleted: z.literal(true) }),
});

export const couponRedemptionDtoSchema = z.object({
  id: z.uuid(),
  learnerName: z.string(),
  courseTitle: z.string().nullable(),
  discountCents: z.number().int().nonnegative(),
  originalAmountCents: z.number().int().nonnegative(),
  finalAmountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: z.iso.datetime(),
});

export const couponRedemptionsListResponseSchema = z.object({
  data: z.object({
    items: z.array(couponRedemptionDtoSchema),
    totalCount: z.number().int().nonnegative(),
  }),
});

export const couponRedemptionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const validateCouponBodySchema = z
  .object({
    code: couponCodeSchema,
    courseId: z.uuid(),
    deviceType: couponDeviceTypeSchema.optional().default("WEB"),
  })
  .strict();

export const priceBreakdownSchema = z.object({
  courseId: z.uuid(),
  courseTitle: z.string(),
  currency: z.string().length(3),
  originalAmountCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  walletCreditsApplied: z.number().int().nonnegative().optional().default(0),
  walletDiscountCents: z.number().int().nonnegative().optional().default(0),
  taxAmountCents: z.number().int().nonnegative().optional().default(0),
  finalAmountCents: z.number().int().nonnegative(),
  coupon: z
    .object({
      id: z.uuid(),
      code: z.string(),
      name: z.string(),
      discountType: couponDiscountTypeSchema,
      discountValue: z.number().int().positive(),
    })
    .nullable(),
  affiliateCode: z.string().nullable().optional(),
});

export const validateCouponResponseSchema = z.object({
  data: priceBreakdownSchema,
});

export const publicCouponDtoSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  discountType: couponDiscountTypeSchema,
  discountValue: z.number().int().positive(),
  maxDiscountCents: z.number().int().positive().nullable(),
  currency: z.string().length(3),
});

export const publicCouponsForCourseQuerySchema = z
  .object({
    courseId: z.uuid(),
  })
  .strict();

export const publicCouponsForCourseResponseSchema = z.object({
  data: z.object({ items: z.array(publicCouponDtoSchema) }),
});

export const checkoutQuoteBodySchema = z
  .object({
    courseId: z.uuid(),
    couponCode: couponCodeSchema.optional().nullable(),
    affiliateCode: couponCodeSchema.optional().nullable(),
    walletCreditsToSpend: z.number().int().nonnegative().optional().nullable(),
    deviceType: couponDeviceTypeSchema.optional().default("WEB"),
  })
  .strict();

export const checkoutQuoteResponseSchema = z.object({
  data: priceBreakdownSchema.extend({
    alreadyEnrolled: z.boolean(),
    couponsAllowed: z.boolean(),
    walletEnabled: z.boolean(),
    walletAvailableBalance: z.number().int().nonnegative(),
    walletCreditValueCents: z.number().int().positive(),
    walletMaxCreditsPerOrder: z.number().int().positive().nullable(),
  }),
});

export const checkoutPurchaseBodySchema = checkoutQuoteBodySchema.extend({
  successUrl: z.url().optional(),
  cancelUrl: z.url().optional(),
});

export const checkoutPurchaseResponseSchema = z.object({
  data: z.object({
    enrollmentId: z.uuid().nullable(),
    paymentOrderId: z.uuid(),
    created: z.boolean(),
    checkoutUrl: z.url().nullable().optional(),
    clientCheckout: z
      .object({
        provider: z.literal("razorpay"),
        keyId: z.string().min(1),
        orderId: z.string().min(1),
        amountCents: z.number().int().nonnegative(),
        currency: z.string().length(3),
        name: z.string().min(1),
        description: z.string().optional(),
        notes: z.record(z.string(), z.string()).optional(),
      })
      .nullable()
      .optional(),
    pricing: priceBreakdownSchema,
  }),
});

export const couponPerformanceQuerySchema = z
  .object({
    couponId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const couponPerformanceItemSchema = z.object({
  couponId: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: couponStatusSchema,
  redemptionCount: z.number().int().nonnegative(),
  totalDiscountCents: z.number().int().nonnegative(),
  totalRevenueCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export const couponPerformanceResponseSchema = z.object({
  data: z.object({ items: z.array(couponPerformanceItemSchema) }),
});
