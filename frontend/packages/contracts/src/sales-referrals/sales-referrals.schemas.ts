import { z } from "zod";

export const referralConfigDtoSchema = z.object({
  enabled: z.boolean(),
  referrerSignupCredits: z.number().int().nonnegative(),
  refereeSignupCredits: z.number().int().nonnegative(),
  referrerPurchaseCredits: z.number().int().nonnegative(),
  maxReferrals: z.number().int().positive().nullable(),
  walletEnabled: z.boolean(),
  updatedAt: z.iso.datetime().nullable(),
});

export const referralConfigResponseSchema = z.object({ data: referralConfigDtoSchema });

export const updateReferralConfigBodySchema = z
  .object({
    enabled: z.boolean(),
    referrerSignupCredits: z.number().int().nonnegative().max(1_000_000),
    refereeSignupCredits: z.number().int().nonnegative().max(1_000_000),
    referrerPurchaseCredits: z.number().int().nonnegative().max(1_000_000),
    maxReferrals: z.number().int().positive().max(1_000_000).optional().nullable(),
  })
  .strict();

export const referralStatsItemSchema = z.object({
  membershipId: z.uuid(),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  code: z.string(),
  successfulReferrals: z.number().int().nonnegative(),
  signupCreditsEarned: z.number().int().nonnegative(),
  purchaseCreditsEarned: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export const referralStatsQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sort: z
      .enum(["successfulReferrals", "creditsEarned", "createdAt"])
      .optional()
      .default("successfulReferrals"),
  })
  .strict();

export const referralStatsResponseSchema = z.object({
  data: z.object({ items: z.array(referralStatsItemSchema) }),
});

export const myReferralResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
    walletEnabled: z.boolean(),
    code: z.string().nullable(),
    sharePath: z.string().nullable(),
    successfulReferrals: z.number().int().nonnegative(),
    totalRewardsEarned: z.number().int().nonnegative(),
    referrerSignupCredits: z.number().int().nonnegative(),
    refereeSignupCredits: z.number().int().nonnegative(),
    referrerPurchaseCredits: z.number().int().nonnegative(),
    maxReferrals: z.number().int().positive().nullable(),
    remainingReferrals: z.number().int().nonnegative().nullable(),
  }),
});

export const publicReferralStatusResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
    walletEnabled: z.boolean(),
  }),
});

export const referralCodeInputSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Referral code must be alphanumeric.");
