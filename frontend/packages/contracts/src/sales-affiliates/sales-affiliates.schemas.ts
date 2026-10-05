import { z } from "zod";

export const affiliateAccessModeSchema = z.enum(["PUBLIC", "PRIVATE"]);
export const affiliateTierSchema = z.enum(["STANDARD", "PREMIUM"]);
export const affiliateStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const affiliateRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const myAffiliateStatusSchema = z.enum(["none", "pending", "active", "inactive"]);

export const affiliateCodeInputSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Affiliate code may only contain letters, numbers, _ and -.");

export const affiliateConfigDtoSchema = z.object({
  enabled: z.boolean(),
  accessMode: affiliateAccessModeSchema,
  askAdmin: z.boolean(),
  standardDiscountPct: z.number().int().min(0).max(100),
  standardCommissionPct: z.number().int().min(0).max(100),
  premiumDiscountPct: z.number().int().min(0).max(100),
  premiumCommissionPct: z.number().int().min(0).max(100),
  updatedAt: z.iso.datetime().nullable(),
});

export const affiliateConfigResponseSchema = z.object({ data: affiliateConfigDtoSchema });

export const updateAffiliateConfigBodySchema = z
  .object({
    enabled: z.boolean(),
    accessMode: affiliateAccessModeSchema,
    askAdmin: z.boolean(),
    standardDiscountPct: z.number().int().min(0).max(100),
    standardCommissionPct: z.number().int().min(0).max(100),
    premiumDiscountPct: z.number().int().min(0).max(100),
    premiumCommissionPct: z.number().int().min(0).max(100),
  })
  .strict();

export const affiliateProductDtoSchema = z.object({
  courseId: z.uuid(),
  courseTitle: z.string().nullable(),
  enabled: z.boolean(),
  standardDiscountPct: z.number().int().min(0).max(100).nullable(),
  standardCommissionPct: z.number().int().min(0).max(100).nullable(),
  premiumDiscountPct: z.number().int().min(0).max(100).nullable(),
  premiumCommissionPct: z.number().int().min(0).max(100).nullable(),
  updatedAt: z.iso.datetime(),
});

export const affiliateProductsResponseSchema = z.object({
  data: z.object({ items: z.array(affiliateProductDtoSchema) }),
});

export const upsertAffiliateProductBodySchema = z
  .object({
    courseId: z.uuid(),
    enabled: z.boolean(),
    standardDiscountPct: z.number().int().min(0).max(100).optional().nullable(),
    standardCommissionPct: z.number().int().min(0).max(100).optional().nullable(),
    premiumDiscountPct: z.number().int().min(0).max(100).optional().nullable(),
    premiumCommissionPct: z.number().int().min(0).max(100).optional().nullable(),
  })
  .strict();

export const affiliatePartnerDtoSchema = z.object({
  id: z.uuid(),
  membershipId: z.uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  tier: affiliateTierSchema,
  status: affiliateStatusSchema,
  couponCode: z.string(),
  /** Masked (audit M6); full details only via the audited reveal route. */
  payoutUpiMasked: z.string().nullable(),
  payoutBankAccountMasked: z.string().nullable(),
  payoutIfsc: z.string().nullable(),
  payoutAccountName: z.string().nullable(),
  payoutDetailsOnFile: z.boolean(),
  unpaidCents: z.number().int().nonnegative(),
  paidCents: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const affiliatesListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).optional().default("ALL"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const affiliatesListResponseSchema = z.object({
  data: z.object({ items: z.array(affiliatePartnerDtoSchema) }),
});

export const createAffiliateBodySchema = z
  .object({
    membershipId: z.uuid(),
    tier: affiliateTierSchema.optional().default("STANDARD"),
    status: affiliateStatusSchema.optional().default("ACTIVE"),
    couponCode: affiliateCodeInputSchema.optional().nullable(),
  })
  .strict();

export const updateAffiliateBodySchema = z
  .object({
    tier: affiliateTierSchema.optional(),
    status: affiliateStatusSchema.optional(),
    couponCode: affiliateCodeInputSchema.optional(),
    payoutUpi: z.string().trim().max(200).optional().nullable(),
    payoutBankAccount: z.string().trim().max(100).optional().nullable(),
    payoutIfsc: z.string().trim().max(20).optional().nullable(),
    payoutAccountName: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export const affiliateSummaryDtoSchema = z.object({
  activePartners: z.number().int().nonnegative(),
  totalPartners: z.number().int().nonnegative(),
  pendingRequests: z.number().int().nonnegative(),
  unpaidCents: z.number().int().nonnegative(),
  paidCents: z.number().int().nonnegative(),
  partnersWithUnpaid: z.number().int().nonnegative(),
  enabledProducts: z.number().int().nonnegative(),
});

export const affiliateSummaryResponseSchema = z.object({
  data: affiliateSummaryDtoSchema,
});

export const affiliateCommissionDtoSchema = z.object({
  id: z.uuid(),
  affiliateId: z.uuid(),
  courseId: z.uuid(),
  paymentOrderId: z.uuid(),
  couponCodeSnapshot: z.string(),
  tierSnapshot: z.string(),
  orderAmountCents: z.number().int().nonnegative(),
  discountCents: z.number().int().nonnegative(),
  commissionCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.enum(["UNPAID", "PAID"]),
  createdAt: z.iso.datetime(),
});

export const affiliateCommissionsListQuerySchema = z
  .object({
    affiliateId: z.uuid().optional(),
    status: z.enum(["ALL", "UNPAID", "PAID"]).optional().default("ALL"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const affiliateCommissionsListResponseSchema = z.object({
  data: z.object({ items: z.array(affiliateCommissionDtoSchema) }),
});

export const affiliatePartnerResponseSchema = z.object({ data: affiliatePartnerDtoSchema });

export const affiliateRequestDtoSchema = z.object({
  id: z.uuid(),
  membershipId: z.uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  status: affiliateRequestStatusSchema,
  note: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const affiliateRequestsListQuerySchema = z
  .object({
    status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).optional().default("PENDING"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const affiliateRequestsListResponseSchema = z.object({
  data: z.object({ items: z.array(affiliateRequestDtoSchema) }),
});

export const reviewAffiliateRequestBodySchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const reviewAffiliateRequestResponseSchema = z.object({
  data: affiliateRequestDtoSchema,
});

export const affiliatePayoutDtoSchema = z.object({
  id: z.uuid(),
  affiliateId: z.uuid(),
  affiliateMembershipId: z.uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.string(),
  note: z.string().nullable(),
  paidAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const affiliatePayoutsListQuerySchema = z
  .object({
    affiliateId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const affiliatePayoutsListResponseSchema = z.object({
  data: z.object({ items: z.array(affiliatePayoutDtoSchema) }),
});

export const markAffiliatePayoutPaidBodySchema = z
  .object({
    affiliateId: z.uuid(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const markAffiliatePayoutPaidResponseSchema = z.object({
  data: affiliatePayoutDtoSchema,
});

export const myAffiliateProductDtoSchema = z.object({
  courseId: z.uuid(),
  courseTitle: z.string().nullable(),
  enabled: z.boolean(),
  discountPct: z.number().int().min(0).max(100),
  commissionPct: z.number().int().min(0).max(100),
});

export const myAffiliateResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
    accessMode: affiliateAccessModeSchema,
    askAdmin: z.boolean(),
    status: myAffiliateStatusSchema,
    code: z.string().nullable(),
    tier: affiliateTierSchema.nullable(),
    products: z.array(myAffiliateProductDtoSchema),
    unpaidCents: z.number().int().nonnegative(),
    paidCents: z.number().int().nonnegative(),
    /** Masked (audit M6): re-enter a value to change it. */
    payoutUpiMasked: z.string().nullable(),
    payoutBankAccountMasked: z.string().nullable(),
    payoutIfsc: z.string().nullable(),
    payoutAccountName: z.string().nullable(),
    payoutDetailsOnFile: z.boolean(),
    sharePath: z.string().nullable(),
  }),
});

export const joinAffiliateProgramBodySchema = z.object({}).strict();

/** Full payout details for paying an affiliate: MFA and an audit entry per reveal (audit M6). */
export const affiliatePayoutDetailsResponseSchema = z.object({
  data: z.object({
    affiliateId: z.uuid(),
    payoutUpi: z.string().nullable(),
    payoutBankAccount: z.string().nullable(),
    payoutIfsc: z.string().nullable(),
    payoutAccountName: z.string().nullable(),
  }),
});

/** Omitted fields are kept; `null` clears a field (audit M6: screens never echo values back). */
export const updateMyAffiliatePayoutBodySchema = z
  .object({
    payoutUpi: z.string().trim().max(200).optional().nullable(),
    payoutBankAccount: z.string().trim().max(100).optional().nullable(),
    payoutIfsc: z.string().trim().max(20).optional().nullable(),
    payoutAccountName: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export const publicAffiliateStatusResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
    accessMode: affiliateAccessModeSchema,
    askAdmin: z.boolean(),
  }),
});

export type ResolveAffiliateCheckoutResult = {
  affiliate: {
    id: string;
    membership_id: string;
    tier: string;
    coupon_code: string;
  };
  discountPct: number;
  commissionPct: number;
  discountCents: number;
};
