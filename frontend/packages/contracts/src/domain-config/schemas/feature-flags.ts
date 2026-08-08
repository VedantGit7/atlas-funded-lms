import { z } from "zod";

export const FeatureFlagViewSchema = z.object({
  key: z.string(),
  canonicalKey: z.string(),
  description: z.string().nullable(),
  value: z.unknown(),
  source: z.enum(["GLOBAL_DEFAULT", "TENANT_OVERRIDE"]),
  readOnly: z.boolean(),
});

export const FeatureFlagListResponseSchema = z.object({
  data: z.array(FeatureFlagViewSchema),
});

export type FeatureFlagView = z.infer<typeof FeatureFlagViewSchema>;
export type FeatureFlagListResponse = z.infer<typeof FeatureFlagListResponseSchema>;
