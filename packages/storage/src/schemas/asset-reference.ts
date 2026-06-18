import { z } from "zod";
import { AssetPurposeSchema, AssetStatusSchema, AssetVisibilitySchema } from "./storage-policy";

export const CreateAssetReferenceInputSchema = z.object({
  purpose: AssetPurposeSchema,
  resourceType: z.string().min(1).max(80),
  resourceId: z.string().uuid().nullable(),
  fileName: z.string().min(1).max(240),
  contentType: z.string().min(1).max(180),
  sizeBytes: z.number().int().min(1),
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .optional(),
  visibility: AssetVisibilitySchema.default("private"),
});

export const AssetReferenceViewSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  bucket: z.string(),
  key: z.string(),
  purpose: AssetPurposeSchema,
  resourceType: z.string(),
  resourceId: z.string().uuid().nullable(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  checksumSha256: z.string().nullable(),
  visibility: AssetVisibilitySchema,
  status: AssetStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SignedUploadResponseSchema = z.object({
  data: z.object({
    asset: AssetReferenceViewSchema,
    upload: z.object({
      method: z.literal("PUT"),
      url: z.string().url(),
      expiresAt: z.string().datetime(),
      requiredHeaders: z.record(z.string(), z.string()),
    }),
  }),
});

export const SignedDownloadResponseSchema = z.object({
  data: z.object({
    url: z.string().url(),
    expiresAt: z.string().datetime(),
  }),
});

export type CreateAssetReferenceInput = z.infer<typeof CreateAssetReferenceInputSchema>;
