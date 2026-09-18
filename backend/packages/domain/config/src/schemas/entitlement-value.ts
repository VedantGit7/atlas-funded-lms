import { z } from "zod";

/**
 * The shape of `entitlements.value_json` (audit finding M11).
 *
 * Historically every row held a bare `true`, and nothing ever read the value —
 * `enforce-entitlement.ts` checked only that a key existed. A plan could say
 * "this tenant may use exports" but never "this tenant may run 500 exports a
 * month", so limits were unenforceable and the only lever was switching a
 * capability off entirely.
 *
 * The bare boolean stays valid. Every seeded entitlement is one, and rejecting
 * them would have meant a data migration before any of this could ship — a
 * quantitative form is added alongside rather than in place of it.
 */

export const usagePeriodSchema = z.enum(["day", "month", "total"]);

const quantitativeSchema = z.object({
  enabled: z.boolean().default(true),
  /**
   * Maximum units per period. Absent means unmetered-but-enabled; the counter
   * still advances, so turning a limit on later has history behind it.
   */
  limit: z.number().int().nonnegative().nullable().default(null),
  period: usagePeriodSchema.default("month"),
});

export const entitlementValueSchema = z.union([z.boolean(), quantitativeSchema]);

export type UsagePeriod = z.infer<typeof usagePeriodSchema>;

export type EntitlementValue = {
  enabled: boolean;
  limit: number | null;
  period: UsagePeriod;
};

/**
 * Normalises either form into one shape.
 *
 * An unparseable value reads as **disabled**, not as enabled. Operator-editable
 * JSON that fails validation is an unknown state, and the safe reading of an
 * unknown entitlement is that the tenant does not have it.
 */
export function parseEntitlementValue(raw: unknown): EntitlementValue {
  const parsed = entitlementValueSchema.safeParse(raw);

  if (!parsed.success) {
    return { enabled: false, limit: null, period: "month" };
  }

  if (typeof parsed.data === "boolean") {
    return { enabled: parsed.data, limit: null, period: "month" };
  }

  return {
    enabled: parsed.data.enabled,
    limit: parsed.data.limit,
    period: parsed.data.period,
  };
}
