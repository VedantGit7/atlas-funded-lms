import { z } from "zod";

export const TenantConfigViewSchema = z.object({
  tenantId: z.uuid(),
  configJson: z.record(z.string(), z.unknown()),
  version: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  currentVersionId: z.uuid().nullable(),
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

export const TenantConfigVersionViewSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  createdByMembershipId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  isCurrent: z.boolean(),
});

export const TenantConfigVersionsResponseSchema = z.object({
  data: z.array(TenantConfigVersionViewSchema),
});

export type TenantConfigVersionView = z.infer<typeof TenantConfigVersionViewSchema>;
export type TenantConfigVersionsResponse = z.infer<typeof TenantConfigVersionsResponseSchema>;
