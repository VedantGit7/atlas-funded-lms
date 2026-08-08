import { z } from "zod";

export const walletReasonSchema = z.enum([
  "REFERRAL_SIGNUP",
  "REFERRAL_PURCHASE",
  "CHECKOUT_SPEND",
  "ADMIN_ADJUST",
  "OTHER",
]);

export const walletDirectionSchema = z.enum(["CREDIT", "DEBIT"]);

export const walletConfigDtoSchema = z.object({
  enabled: z.boolean(),
  creditValueCents: z.number().int().positive(),
  currency: z.string().length(3),
  maxBalanceCredits: z.number().int().positive().nullable(),
  maxCreditsPerOrder: z.number().int().positive().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const walletConfigResponseSchema = z.object({ data: walletConfigDtoSchema });

export const updateWalletConfigBodySchema = z
  .object({
    enabled: z.boolean(),
    creditValueCents: z.number().int().positive().max(1_000_000),
    currency: z.string().trim().length(3),
    maxBalanceCredits: z.number().int().positive().optional().nullable(),
    maxCreditsPerOrder: z.number().int().positive().optional().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.maxBalanceCredits != null &&
      value.maxCreditsPerOrder != null &&
      value.maxCreditsPerOrder > value.maxBalanceCredits
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Max credits per order cannot exceed max wallet balance.",
        path: ["maxCreditsPerOrder"],
      });
    }
  });

export const walletAccountDtoSchema = z.object({
  membershipId: z.string().uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  balanceCredits: z.number().int().nonnegative(),
  earnedCredits: z.number().int().nonnegative(),
  usedCredits: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const walletAccountsListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const walletAccountsListResponseSchema = z.object({
  data: z.object({ items: z.array(walletAccountDtoSchema) }),
});

export const walletAccountDetailQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const walletTransactionDtoSchema = z.object({
  id: z.string().uuid(),
  direction: walletDirectionSchema,
  reason: walletReasonSchema,
  credits: z.number().int().positive(),
  balanceAfter: z.number().int().nonnegative(),
  moneyCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  paymentOrderId: z.string().uuid().nullable(),
  courseId: z.string().uuid().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const walletAccountDetailResponseSchema = z.object({
  data: z.object({
    account: walletAccountDtoSchema,
    transactions: z.array(walletTransactionDtoSchema),
  }),
});

export const myWalletResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
    creditValueCents: z.number().int().positive(),
    currency: z.string().length(3),
    maxCreditsPerOrder: z.number().int().positive().nullable(),
    availableBalance: z.number().int().nonnegative(),
    earnedCredits: z.number().int().nonnegative(),
    usedCredits: z.number().int().nonnegative(),
    transactions: z.array(walletTransactionDtoSchema),
  }),
});

export const adjustWalletBodySchema = z
  .object({
    membershipId: z.string().uuid(),
    direction: walletDirectionSchema,
    credits: z.number().int().positive().max(1_000_000),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const adjustWalletResponseSchema = z.object({
  data: walletAccountDtoSchema,
});
