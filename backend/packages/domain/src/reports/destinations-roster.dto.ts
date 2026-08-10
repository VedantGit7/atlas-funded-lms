import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const DESTINATION_KINDS = ["email", "webhook", "storage"] as const;
export type DestinationKind = (typeof DESTINATION_KINDS)[number];

export const DESTINATION_STATUS_FILTERS = ["all", "enabled", "disabled", "failing"] as const;
export type DestinationStatusFilter = (typeof DESTINATION_STATUS_FILTERS)[number];

export const DESTINATION_SORTS = [
  "name_asc",
  "updated_desc",
  "last_delivery_desc",
  "failures_desc",
] as const;
export type DestinationSort = (typeof DESTINATION_SORTS)[number];

export const WEBHOOK_RETRY_POLICIES = ["none", "3x", "5x"] as const;
export const WEBHOOK_PAYLOAD_FORMATS = ["multipart", "json_signed_url"] as const;
export const STORAGE_PROVIDERS = ["s3", "gcs", "azure"] as const;

export const HEALTH_DAY_STATUSES = ["success", "fail", "empty"] as const;
export type HealthDayStatus = (typeof HEALTH_DAY_STATUSES)[number];

const pageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const destinationsRosterListQuerySchema = rejectClientTenantFields
  .extend({
    q: z.string().trim().min(1).max(200).optional(),
    kind: z
      .enum([...DESTINATION_KINDS, "any"] as const)
      .optional()
      .default("any"),
    status: z.enum(DESTINATION_STATUS_FILTERS).optional().default("all"),
    sort: z.enum(DESTINATION_SORTS).optional().default("updated_desc"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type DestinationsRosterListQuery = z.output<typeof destinationsRosterListQuerySchema>;

const emailTargetSchema = z
  .object({
    address: z.string().email(),
    isExternal: z.boolean(),
  })
  .strict();

export const destinationItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    kind: z.enum(DESTINATION_KINDS),
    isActive: z.boolean(),
    isFailing: z.boolean(),
    emails: z.array(emailTargetSchema),
    webhookHost: z.string().nullable(),
    webhookPathTruncated: z.string().nullable(),
    webhookUrl: z.string().nullable(),
    signingSecretMasked: z.string().nullable(),
    hasSigningSecret: z.boolean(),
    retryPolicy: z.enum(WEBHOOK_RETRY_POLICIES).nullable(),
    payloadFormat: z.enum(WEBHOOK_PAYLOAD_FORMATS).nullable(),
    storageProvider: z.enum(STORAGE_PROVIDERS).nullable(),
    storageBucket: z.string().nullable(),
    storagePrefix: z.string().nullable(),
    hasCredentials: z.boolean(),
    credentialsMasked: z.string().nullable(),
    lastDeliveryAt: z.string().datetime().nullable(),
    lastDeliveryStatus: z.enum(["succeeded", "failed", "pending"]).nullable(),
    lastError: z.string().nullable(),
    consecutiveFailures: z.number().int().nonnegative(),
    scheduleCount: z.number().int().nonnegative(),
    linkedSchedules: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
      }),
    ),
    health30d: z.array(z.enum(HEALTH_DAY_STATUSES)),
    externalRecipientCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const destinationsRosterSummarySchema = z
  .object({
    totalCount: z.number().int().nonnegative(),
    emailCount: z.number().int().nonnegative(),
    webhookCount: z.number().int().nonnegative(),
    storageCount: z.number().int().nonnegative(),
    deliveriesThisMonth: z.number().int().nonnegative(),
    deliveriesSucceededThisMonth: z.number().int().nonnegative(),
    failingCount: z.number().int().nonnegative(),
    failingCaption: z.string().nullable(),
    externalRecipientCount: z.number().int().nonnegative(),
    lastDeliveryAt: z.string().datetime().nullable(),
    tenantEmailDomains: z.array(z.string()),
  })
  .strict();

export const destinationsRosterListResponseSchema = z.object({
  data: z.object({
    items: z.array(destinationItemSchema),
    pageInfo: pageInfoSchema,
    summary: destinationsRosterSummarySchema,
  }),
});

const createEmailBodySchema = z
  .object({
    kind: z.literal("email"),
    name: z.string().trim().min(1).max(120),
    emails: z.array(z.string().email()).min(1).max(50),
  })
  .strict();

const createWebhookBodySchema = z
  .object({
    kind: z.literal("webhook"),
    name: z.string().trim().min(1).max(120),
    url: z.string().url().max(2000),
    signingSecret: z.string().trim().min(8).max(256).optional(),
    retryPolicy: z.enum(WEBHOOK_RETRY_POLICIES).default("3x"),
    payloadFormat: z.enum(WEBHOOK_PAYLOAD_FORMATS).default("multipart"),
  })
  .strict();

const createStorageBodySchema = z
  .object({
    kind: z.literal("storage"),
    name: z.string().trim().min(1).max(120),
    provider: z.enum(STORAGE_PROVIDERS).default("s3"),
    bucket: z.string().trim().min(1).max(200),
    prefix: z.string().trim().max(500).optional().default(""),
    credentials: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

export const createDestinationBodySchema = z.discriminatedUnion("kind", [
  createEmailBodySchema,
  createWebhookBodySchema,
  createStorageBodySchema,
]);

export type CreateDestinationBody = z.output<typeof createDestinationBodySchema>;

export const createDestinationResponseSchema = z.object({
  data: destinationItemSchema,
});

export const destinationParamsSchema = z
  .object({
    destinationId: z.string().uuid(),
  })
  .strict();

export const updateDestinationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
    emails: z.array(z.string().email()).min(1).max(50).optional(),
    url: z.string().url().max(2000).optional(),
    signingSecret: z.string().trim().min(8).max(256).optional(),
    retryPolicy: z.enum(WEBHOOK_RETRY_POLICIES).optional(),
    payloadFormat: z.enum(WEBHOOK_PAYLOAD_FORMATS).optional(),
    provider: z.enum(STORAGE_PROVIDERS).optional(),
    bucket: z.string().trim().min(1).max(200).optional(),
    prefix: z.string().trim().max(500).optional(),
    credentials: z.string().trim().min(1).max(4000).optional(),
  })
  .strict()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "At least one field is required.",
  });

export type UpdateDestinationBody = z.output<typeof updateDestinationBodySchema>;

export const updateDestinationResponseSchema = z.object({
  data: destinationItemSchema,
});

export const deleteDestinationResponseSchema = z.object({
  data: z.object({
    deleted: z.literal(true),
    id: z.string().uuid(),
    affectedSchedules: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
      }),
    ),
  }),
});

export const testDestinationResponseSchema = z.object({
  data: z.object({
    ok: z.boolean(),
    message: z.string(),
    testedAt: z.string().datetime(),
    destination: destinationItemSchema,
  }),
});

export const exportDestinationsResponseSchema = z.object({
  data: z.object({
    format: z.literal("csv"),
    filename: z.string(),
    contentType: z.literal("text/csv; charset=utf-8"),
    content: z.string(),
  }),
});
