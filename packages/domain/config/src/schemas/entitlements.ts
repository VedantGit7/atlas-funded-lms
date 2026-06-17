import { z } from "zod";

export const EntitlementKeySchema = z.string().min(1).max(120);

export const EntitlementViewSchema = z.object({
  key: z.string(),
  value: z.unknown().nullable(),
  enabled: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
});

export const EntitlementListResponseSchema = z.object({
  data: z.array(EntitlementViewSchema),
});

export type EntitlementView = z.infer<typeof EntitlementViewSchema>;
export type EntitlementListResponse = z.infer<typeof EntitlementListResponseSchema>;
