import { z } from "zod";
import { ALLOCATION_KEYS, COST_DRIVER_KEYS } from "../cost-attribution.catalog";

/**
 * Wire schemas for per-tenant cost attribution (DoD item 8).
 *
 * Money arrives as a decimal string, not a JSON number. Several unit rates are
 * fractions of a cent (an email is $0.0001), and a JSON number carrying one of
 * those passes through binary floating point before it ever reaches the numeric
 * column that stores it exactly.
 */

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the form YYYY-MM.");

const ReasonSchema = z.string().trim().min(10).max(1000);

const UnitCostSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,6})?$/, "Up to 8 whole digits and 6 decimal places, no sign.");

const MonthlyAmountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Up to 10 whole digits and 2 decimal places, no sign.");

export const CostDriverKeySchema = z.enum(COST_DRIVER_KEYS);
export const AllocationKeySchema = z.enum(ALLOCATION_KEYS);

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const CostReportQuerySchema = z
  .object({
    month: MonthSchema.optional(),
  })
  .strict();

export const SetCostRateRequestSchema = z
  .object({
    driver: CostDriverKeySchema,
    unitCostUsd: UnitCostSchema,
    effectiveFrom: MonthSchema,
    reason: ReasonSchema,
  })
  .strict();

export const CreateFixedCostRequestSchema = z
  .object({
    label: z.string().trim().min(2).max(120),
    monthlyCostUsd: MonthlyAmountSchema,
    allocationKey: AllocationKeySchema,
    effectiveFrom: MonthSchema,
    reason: ReasonSchema,
  })
  .strict();

export const EndFixedCostRequestSchema = z
  .object({
    effectiveUntil: MonthSchema,
    reason: ReasonSchema,
  })
  .strict();

export const FixedCostParamsSchema = z.object({ id: z.uuid() }).strict();

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const TenantUsageSchema = z.object({
  activeMembers: z.number(),
  memberDays: z.number(),
  apiRequests: z.number(),
  apiServerMs: z.number(),
  storageGb: z.number(),
  emailsSent: z.number(),
  customDomains: z.number(),
});

const RateSchema = z.object({ unitCostUsd: z.number(), effectiveFrom: MonthSchema });

export const CostReportResponseSchema = z.object({
  data: z.object({
    month: MonthSchema,
    currency: z.literal("USD"),
    /** True for the current month: usage is still accumulating. */
    isPartialMonth: z.boolean(),
    snapshotAt: z.iso.datetime(),
    tenants: z.array(
      z.object({
        tenantId: z.uuid(),
        slug: z.string(),
        displayName: z.string(),
        state: z.string(),
        usage: TenantUsageSchema,
        variableCosts: z.record(CostDriverKeySchema, z.number().nullable()),
        variableCostUsd: z.number(),
        fixedCostUsd: z.number(),
        totalCostUsd: z.number(),
        costPerActiveMemberUsd: z.number().nullable(),
        shareOfTotal: z.number(),
      }),
    ),
    drivers: z.array(
      z.object({
        key: CostDriverKeySchema,
        label: z.string(),
        unit: z.string(),
        rate: RateSchema.nullable(),
        totalQuantity: z.number(),
        totalCostUsd: z.number().nullable(),
      }),
    ),
    fixedCosts: z.array(
      z.object({
        id: z.uuid(),
        label: z.string(),
        monthlyCostUsd: z.number(),
        allocationKey: AllocationKeySchema,
        fellBackToEqualSplit: z.boolean(),
        allocated: z.boolean(),
      }),
    ),
    totals: z.object({
      variableCostUsd: z.number(),
      fixedCostUsd: z.number(),
      unallocatedFixedCostUsd: z.number(),
      totalCostUsd: z.number(),
      activeMembers: z.number(),
      costPerActiveMemberUsd: z.number().nullable(),
    }),
    unpricedDrivers: z.array(CostDriverKeySchema),
    /**
     * Costs the platform incurs that this report cannot yet see, listed so the
     * total is read as a floor rather than as everything.
     */
    notMetered: z.array(z.object({ key: z.string(), label: z.string(), why: z.string() })),
  }),
});

const RateHistoryEntrySchema = z.object({
  id: z.uuid(),
  driver: CostDriverKeySchema,
  unitCostUsd: z.number(),
  effectiveFrom: MonthSchema,
  reason: z.string(),
  createdAt: z.iso.datetime(),
});

const FixedCostEntrySchema = z.object({
  id: z.uuid(),
  label: z.string(),
  monthlyCostUsd: z.number(),
  allocationKey: AllocationKeySchema,
  effectiveFrom: MonthSchema,
  effectiveUntil: MonthSchema.nullable(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});

export const CostRateCardResponseSchema = z.object({
  data: z.object({
    currency: z.literal("USD"),
    drivers: z.array(
      z.object({
        key: CostDriverKeySchema,
        label: z.string(),
        unit: z.string(),
        current: RateSchema.nullable(),
        suggestion: z.object({ unitCostUsd: z.number(), source: z.string() }).nullable(),
      }),
    ),
    allocationKeys: z.array(z.object({ key: AllocationKeySchema, label: z.string() })),
    rateHistory: z.array(RateHistoryEntrySchema),
    fixedCosts: z.array(FixedCostEntrySchema),
  }),
});

export const CostRateResponseSchema = z.object({ data: RateHistoryEntrySchema });
export const FixedCostResponseSchema = z.object({ data: FixedCostEntrySchema });

export type CostReportQuery = z.infer<typeof CostReportQuerySchema>;
export type SetCostRateRequest = z.infer<typeof SetCostRateRequestSchema>;
export type CreateFixedCostRequest = z.infer<typeof CreateFixedCostRequestSchema>;
export type EndFixedCostRequest = z.infer<typeof EndFixedCostRequestSchema>;
export type CostReportResponse = z.infer<typeof CostReportResponseSchema>;
export type CostRateCardResponse = z.infer<typeof CostRateCardResponseSchema>;
