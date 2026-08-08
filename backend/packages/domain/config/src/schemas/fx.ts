import { z } from "zod";

/**
 * FX rates are cached per tenant relative to a single base currency (USD).
 * `rates` maps an ISO-4217 code to "how many units of that currency equal one
 * unit of base". The base itself is always present with rate 1. Conversion
 * between any two currencies A -> B is `amount * rates[B] / rates[A]`.
 */
export const FxRatesResponseSchema = z.object({
  data: z.object({
    base: z.string(),
    asOf: z.string().nullable(),
    fetchedAt: z.string().datetime().nullable(),
    rates: z.record(z.string(), z.number()),
  }),
});

export type FxRatesResponse = z.infer<typeof FxRatesResponseSchema>;
