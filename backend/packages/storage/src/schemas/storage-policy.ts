import { z } from "zod";

export const AssetVisibilitySchema = z.enum(["private", "public-safe"]);

export const AssetPurposeSchema = z.enum([
  "branding.logo",
  "branding.favicon",
  "branding.og-image",
  "lesson.asset",
  "lesson.attachment",
  "lesson.thumbnail",
  "module.scorm",
  "certificate.template",
  "certificate.render",
  "certificate.wallet",
  "community.attachment",
  "export.file",
  "temp.upload",
  "member.avatar",
]);

export const AssetStatusSchema = z.enum(["PENDING_UPLOAD", "READY", "FAILED", "DELETED"]);

export const StoragePolicyInputSchema = z.object({
  purpose: AssetPurposeSchema,
  contentType: z.string().min(1).max(180),
  sizeBytes: z.number().int().min(1),
  visibility: AssetVisibilitySchema,
});

export type AssetPurpose = z.infer<typeof AssetPurposeSchema>;
export type AssetVisibility = z.infer<typeof AssetVisibilitySchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type StoragePolicyInput = z.infer<typeof StoragePolicyInputSchema>;
