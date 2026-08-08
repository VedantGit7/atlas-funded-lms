import { z } from "zod";

export const DomainTypeSchema = z.enum(["ATLAS_SUBDOMAIN", "CUSTOM_DOMAIN"]);

export const DomainStatusSchema = z.enum(["PENDING", "VERIFYING", "ACTIVE", "FAILED", "DISABLED"]);

export const TenantDomainViewSchema = z.object({
  id: z.string().uuid(),
  hostname: z.string(),
  type: DomainTypeSchema,
  status: DomainStatusSchema,
  isPrimary: z.boolean(),
  verificationTxtName: z.string().nullable(),
  verificationTxtValue: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DomainListResponseSchema = z.object({
  data: z.array(TenantDomainViewSchema),
});

export const CreateDomainRequestSchema = z.object({
  hostname: z
    .string()
    .min(3)
    .max(253)
    .transform((value) => value.trim().toLowerCase()),
  type: DomainTypeSchema.default("CUSTOM_DOMAIN"),
  makePrimary: z.boolean().default(false),
});

export const CreateDomainResponseSchema = z.object({
  data: TenantDomainViewSchema,
});

export const DomainParamsSchema = z.object({
  id: z.string().uuid(),
});

export const DeleteDomainResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: DomainStatusSchema,
  }),
});

export const SetPrimaryDomainResponseSchema = z.object({
  data: TenantDomainViewSchema,
});
