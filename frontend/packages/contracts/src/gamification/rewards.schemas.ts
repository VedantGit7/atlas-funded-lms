import { z } from "zod";
import { entityStatusSchema } from "../competency/competency-config.schemas";

const rewardKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);

export const currencyEarnRulesSchema = z
  .object({
    /** Earn 1 coin per this many XP (per accrual event, floored). */
    xpPerCoin: z.number().int().min(1).max(100000).nullable().optional(),
  })
  .strict();

export const currencyDtoSchema = z.object({
  key: z.string(),
  name: z.string(),
  symbol: z.string().nullable(),
  earnRules: currencyEarnRulesSchema.nullable(),
});

export const upsertCurrencyInputSchema = z
  .object({
    key: rewardKeySchema,
    name: z.string().min(1).max(80),
    symbol: z.string().min(1).max(8).nullable().optional(),
    earnRules: currencyEarnRulesSchema.nullable().optional(),
  })
  .strict();

export const REWARD_TYPES = ["CONTENT_UNLOCK", "DISCOUNT_CODE", "CERTIFICATE", "CUSTOM"] as const;

export const rewardPayloadSchema = z
  .object({
    courseId: z.string().uuid().optional(),
    code: z.string().min(1).max(120).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

export const rewardItemDtoSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  costCurrencyKey: z.string(),
  costAmount: z.number().int(),
  rewardType: z.enum(REWARD_TYPES),
  rewardPayload: rewardPayloadSchema,
  stock: z.number().int().nullable(),
  status: entityStatusSchema,
});

export const createRewardItemInputSchema = z
  .object({
    key: rewardKeySchema,
    name: z.string().min(1).max(160),
    description: z.string().max(2000).nullable().optional(),
    costCurrencyKey: rewardKeySchema,
    costAmount: z.number().int().min(1).max(1000000),
    rewardType: z.enum(REWARD_TYPES),
    rewardPayload: rewardPayloadSchema.default({}),
    stock: z.number().int().min(0).nullable().optional(),
    status: entityStatusSchema.default("ACTIVE"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.rewardType === "CONTENT_UNLOCK" && !value.rewardPayload.courseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CONTENT_UNLOCK rewards need rewardPayload.courseId.",
        path: ["rewardPayload", "courseId"],
      });
    }
    if (value.rewardType === "DISCOUNT_CODE" && !value.rewardPayload.code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DISCOUNT_CODE rewards need rewardPayload.code.",
        path: ["rewardPayload", "code"],
      });
    }
  });

export const postRewardsBodySchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("upsert_currency"),
      currency: upsertCurrencyInputSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("create_item"),
      item: createRewardItemInputSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("grant_balance"),
      membershipId: z.string().uuid(),
      currencyKey: rewardKeySchema,
      amount: z.number().int().min(1).max(1000000),
      reason: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      operation: z.literal("revoke_balance"),
      membershipId: z.string().uuid(),
      currencyKey: rewardKeySchema,
      amount: z.number().int().min(1).max(1000000),
      reason: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      operation: z.literal("fulfill_redemption"),
      redemptionId: z.string().uuid(),
    })
    .strict(),
]);

export const updateRewardItemBodySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).nullable().optional(),
    costAmount: z.number().int().min(1).max(1000000).optional(),
    rewardPayload: rewardPayloadSchema.optional(),
    stock: z.number().int().min(0).nullable().optional(),
    status: entityStatusSchema.optional(),
  })
  .strict();

export const rewardsAdminResponseSchema = z.object({
  data: z.object({
    currencies: z.array(currencyDtoSchema),
    items: z.array(rewardItemDtoSchema),
  }),
});

export const rewardsMutationResponseSchema = z.object({
  data: z.object({
    currencies: z.array(currencyDtoSchema).optional(),
    item: rewardItemDtoSchema.optional(),
    balance: z
      .object({
        membershipId: z.string().uuid(),
        currencyKey: z.string(),
        balance: z.number().int(),
      })
      .optional(),
    redemption: z
      .object({
        id: z.string().uuid(),
        status: z.string(),
      })
      .optional(),
  }),
});

export const redemptionLogQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(200).optional(),
    status: z.string().max(40).optional(),
  })
  .strict();

export const redemptionLogItemSchema = z.object({
  id: z.string().uuid(),
  rewardItemId: z.string().uuid(),
  rewardName: z.string(),
  rewardType: z.string(),
  membershipId: z.string().uuid(),
  memberLabel: z.string(),
  costAmount: z.number().int(),
  status: z.string(),
  redeemedAt: z.string().datetime(),
});

export const redemptionLogResponseSchema = z.object({
  data: z.object({
    items: z.array(redemptionLogItemSchema),
    nextCursor: z.string().nullable(),
  }),
});

export const myRewardsResponseSchema = z.object({
  data: z.object({
    balances: z.array(
      z.object({
        currencyKey: z.string(),
        currencyName: z.string(),
        symbol: z.string().nullable(),
        balance: z.number().int(),
      }),
    ),
    items: z.array(rewardItemDtoSchema),
    redemptions: z.array(
      z.object({
        id: z.string().uuid(),
        rewardName: z.string(),
        rewardType: z.string(),
        costAmount: z.number().int(),
        status: z.string(),
        redeemedAt: z.string().datetime(),
      }),
    ),
  }),
});

export const redeemBodySchema = z
  .object({
    rewardItemId: z.string().uuid(),
  })
  .strict();

export const redeemResponseSchema = z.object({
  data: z.object({
    redemptionId: z.string().uuid(),
    status: z.string(),
    balance: z.number().int(),
    code: z.string().nullable(),
  }),
});

export type CurrencyEarnRules = z.infer<typeof currencyEarnRulesSchema>;
export type RewardPayload = z.infer<typeof rewardPayloadSchema>;
export type RewardType = (typeof REWARD_TYPES)[number];
