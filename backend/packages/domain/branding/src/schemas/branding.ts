import { z } from "zod";

export const BrandingAssetRefSchema = z.object({
  storageRefId: z.string().uuid().nullable(),
  altText: z.string().max(180).nullable(),
});

export const TenantBrandingViewSchema = z.object({
  tenantId: z.string().uuid(),
  displayName: z.string(),
  publicName: z.string().nullable(),
  logoLight: BrandingAssetRefSchema.nullable(),
  logoDark: BrandingAssetRefSchema.nullable(),
  favicon: BrandingAssetRefSchema.nullable(),
  issuerName: z.string().max(160).nullable(),
  publicLandingCopy: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  version: z.number().int().min(0),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});

export const UpdateTenantBrandingRequestSchema = z.object({
  publicName: z.string().min(2).max(120).nullable().optional(),
  logoLight: BrandingAssetRefSchema.nullable().optional(),
  logoDark: BrandingAssetRefSchema.nullable().optional(),
  favicon: BrandingAssetRefSchema.nullable().optional(),
  issuerName: z.string().min(2).max(160).nullable().optional(),
  publicLandingCopy: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const BrandingResponseSchema = z.object({
  data: TenantBrandingViewSchema,
});

export const BrandingVersionViewSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  snapshot: z.unknown(),
  publishedByMembershipId: z.string().uuid().nullable(),
  publishedAt: z.string().datetime(),
});

export const BrandingVersionsResponseSchema = z.object({
  data: z.array(BrandingVersionViewSchema),
});

export type UpdateTenantBrandingRequest = z.infer<typeof UpdateTenantBrandingRequestSchema>;
