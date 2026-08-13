import { z } from "zod";

/** Point-in-time values for the "current" period column and the KPI tiles. */
export const UsageCurrentSchema = z.object({
  bandwidthGb: z.number().nonnegative(),
  testSubmits: z.number().int().nonnegative(),
  drmTokens: z.number().int().nonnegative(),
  messageSends: z.number().int().nonnegative(),
  emailValidations: z.number().int().nonnegative(),
  totalLearners: z.number().int().nonnegative(),
  contentStorageGb: z.number().nonnegative(),
  products: z.number().int().nonnegative(),
  videoTranscodingHours: z.number().nonnegative(),
  questions: z.number().int().nonnegative(),
});

export const UsagePointSchema = z.object({
  period: z.string(),
  value: z.number().int().nonnegative(),
});

export const UsageMauSchema = z.object({
  monthly: z.array(UsagePointSchema),
  daily: z.array(UsagePointSchema),
  comparison: z.object({
    current: z.number().int().nonnegative(),
    m1: z.number().int().nonnegative().nullable(),
    m3: z.number().int().nonnegative().nullable(),
    m6: z.number().int().nonnegative().nullable(),
    m9: z.number().int().nonnegative().nullable(),
  }),
});

/** One month of gauge snapshots (Tier-A metrics that accrue via the snapshot job). */
export const UsageHistoryEntrySchema = z.object({
  period: z.string(),
  storageGb: z.number().nonnegative(),
  totalLearners: z.number().int().nonnegative(),
  products: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  testSubmits: z.number().int().nonnegative(),
  messageSends: z.number().int().nonnegative(),
  emailValidations: z.number().int().nonnegative(),
});

export const UsageLimitsSchema = z.object({
  storageGb: z.number().nonnegative().nullable(),
  mau: z.number().nonnegative().nullable(),
  bandwidthGb: z.number().nonnegative().nullable(),
  videoHours: z.number().nonnegative().nullable(),
});

export const UsageSummaryResponseSchema = z.object({
  data: z.object({
    plan: z.object({
      name: z.string().nullable(),
      startedAt: z.iso.datetime().nullable(),
      nextBillingAt: z.iso.datetime().nullable(),
    }),
    limits: UsageLimitsSchema,
    kpis: z.object({
      averageMau: z.number().int().nonnegative(),
      totalLearners: z.number().int().nonnegative(),
      totalVideoHours: z.number().nonnegative(),
      totalStorageGb: z.number().nonnegative(),
    }),
    current: UsageCurrentSchema,
    mau: UsageMauSchema,
    history: z.array(UsageHistoryEntrySchema),
  }),
});

export type UsageCurrent = z.infer<typeof UsageCurrentSchema>;
export type UsageLimitsView = z.infer<typeof UsageLimitsSchema>;
export type UsagePoint = z.infer<typeof UsagePointSchema>;
export type UsageMau = z.infer<typeof UsageMauSchema>;
export type UsageHistoryEntry = z.infer<typeof UsageHistoryEntrySchema>;
export type UsageSummaryResponse = z.infer<typeof UsageSummaryResponseSchema>;
