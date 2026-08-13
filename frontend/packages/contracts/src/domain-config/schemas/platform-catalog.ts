import { z } from "zod";

export const PlatformPermissionCatalogEntrySchema = z.object({
  id: z.uuid(),
  key: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const PlatformItemTypeCatalogEntrySchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  rendererKey: z.string(),
  isBuiltin: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const PlatformExtensionPointCatalogEntrySchema = z.object({
  id: z.uuid(),
  key: z.string(),
  pointType: z.string(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const PlatformPermissionCatalogListResponseSchema = z.object({
  data: z.array(PlatformPermissionCatalogEntrySchema),
});

export const PlatformItemTypeCatalogListResponseSchema = z.object({
  data: z.array(PlatformItemTypeCatalogEntrySchema),
});

export const PlatformExtensionPointCatalogListResponseSchema = z.object({
  data: z.array(PlatformExtensionPointCatalogEntrySchema),
});

export const CreatePlatformPermissionRequestSchema = z.object({
  key: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  reason: z.string().min(10).max(1000),
});

export const CreatePlatformItemTypeRequestSchema = z.object({
  key: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  rendererKey: z.string().min(2).max(80),
  schemaJson: z.record(z.string(), z.unknown()).default({}),
  gradingJson: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().min(10).max(1000),
});

export const CreatePlatformExtensionPointRequestSchema = z.object({
  key: z.string().min(2).max(120),
  pointType: z.string().min(2).max(80),
  schemaJson: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().min(10).max(1000),
});
