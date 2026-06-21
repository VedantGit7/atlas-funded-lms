import { z } from "zod";

export const TenantConfigViewSchema = z.object({
  tenantId: z.string().uuid(),
  configJson: z.record(z.string(), z.unknown()),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  currentVersionId: z.string().uuid().nullable(),
});

export const TenantConfigResponseSchema = z.object({
  data: TenantConfigViewSchema,
});

export const UpdateTenantConfigRequestSchema = z
  .object({
    configJson: z.record(z.string(), z.unknown()),
  })
  .strict();

export type TenantConfigView = z.infer<typeof TenantConfigViewSchema>;
export type TenantConfigResponse = z.infer<typeof TenantConfigResponseSchema>;
export type UpdateTenantConfigRequest = z.infer<typeof UpdateTenantConfigRequestSchema>;

export const UpdateFeatureFlagRequestSchema = z
  .object({
    value: z.unknown(),
  })
  .strict();

export type UpdateFeatureFlagRequest = z.infer<typeof UpdateFeatureFlagRequestSchema>;
