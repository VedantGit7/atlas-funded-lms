import { z } from "zod";

export const PlatformFeatureFlagViewSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  defaultValue: z.unknown(),
  description: z.string().nullable(),
  rolloutType: z.enum(["BOOLEAN", "JSON"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PlatformFeatureFlagListResponseSchema = z.object({
  data: z.array(PlatformFeatureFlagViewSchema),
});

export const CreatePlatformFeatureFlagRequestSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  defaultValue: z.unknown(),
  description: z.string().max(500).nullable().optional(),
  rolloutType: z.enum(["BOOLEAN", "JSON"]).default("BOOLEAN"),
  reason: z.string().min(10).max(1000),
});

export const UpdatePlatformFeatureFlagRequestSchema = z.object({
  defaultValue: z.unknown(),
  description: z.string().max(500).nullable().optional(),
  rolloutType: z.enum(["BOOLEAN", "JSON"]).optional(),
  reason: z.string().min(10).max(1000),
});

export const PlatformFeatureFlagParamsSchema = z.object({
  key: z.string().min(1).max(120),
});

export type PlatformFeatureFlagView = z.infer<typeof PlatformFeatureFlagViewSchema>;
