import { z } from "zod";

export const TenantStateSchema = z.enum([
  "PROVISIONING",
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
  "DELETED",
]);

export const ProvisionTenantRequestSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().min(2).max(120),
  legalName: z.string().max(180).nullable().optional(),
  defaultLocale: z.string().min(2).max(12).default("en"),
  defaultTimezone: z.string().min(1).max(80).default("UTC"),
  owner: z.object({
    email: z.string().email(),
    displayName: z.string().min(2).max(120),
  }),
  initialEntitlements: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        value: z.unknown().nullable().optional(),
        enabled: z.boolean().default(true),
        expiresAt: z.string().datetime().nullable().optional(),
      }),
    )
    .default([]),
  seedProfile: z.enum(["EMPTY", "STANDARD"]).default("STANDARD"),
});

export const PlatformTenantViewSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  displayName: z.string(),
  legalName: z.string().nullable(),
  state: TenantStateSchema,
  defaultLocale: z.string(),
  defaultTimezone: z.string(),
  primaryDomain: z
    .object({
      id: z.string().uuid(),
      hostname: z.string(),
      status: z.string(),
      type: z.string(),
    })
    .nullable(),
  provisioning: z.object({
    latestJobId: z.string().uuid().nullable(),
    latestStatus: z.string().nullable(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PlatformTenantListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  state: TenantStateSchema.optional(),
  q: z.string().max(120).optional(),
});

export const PlatformTenantListResponseSchema = z.object({
  data: z.array(PlatformTenantViewSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

export const PlatformTenantDetailResponseSchema = z.object({
  data: PlatformTenantViewSchema,
});

export const ProvisionTenantResponseSchema = z.object({
  data: PlatformTenantViewSchema,
});

export const PlatformTenantParamsSchema = z.object({
  id: z.string().uuid(),
});

export const TenantLifecycleRequestSchema = z.object({
  reason: z.string().min(10).max(1000),
});

export const ProvisioningJobViewSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  status: z.string(),
  step: z.string().nullable(),
  errorCode: z.string().nullable(),
  safeErrorMessage: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProvisioningJobListResponseSchema = z.object({
  data: z.array(ProvisioningJobViewSchema),
});

export const PlatformTenantEntitlementViewSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  value: z.unknown().nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export const PlatformTenantEntitlementListResponseSchema = z.object({
  data: z.array(PlatformTenantEntitlementViewSchema),
});

export const PutPlatformTenantEntitlementsRequestSchema = z.object({
  entitlements: z.array(PlatformTenantEntitlementViewSchema),
  reason: z.string().min(10).max(1000),
});

export type PutPlatformTenantEntitlementsRequest = z.infer<
  typeof PutPlatformTenantEntitlementsRequestSchema
>;
export type PlatformTenantEntitlementInput = z.infer<typeof PlatformTenantEntitlementViewSchema>;
export type ProvisionTenantRequest = z.infer<typeof ProvisionTenantRequestSchema>;
export type PlatformTenantListQuery = z.infer<typeof PlatformTenantListQuerySchema>;
