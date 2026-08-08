import { z } from "zod";

export const SubscriptionViewSchema = z.object({
  id: z.string(),
  planName: z.string(),
  currency: z.string(),
  status: z.string(),
  durationType: z.string(),
  nextBillingAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SubscriptionListResponseSchema = z.object({
  data: z.array(SubscriptionViewSchema),
});

export type SubscriptionView = z.infer<typeof SubscriptionViewSchema>;
export type SubscriptionListResponse = z.infer<typeof SubscriptionListResponseSchema>;
