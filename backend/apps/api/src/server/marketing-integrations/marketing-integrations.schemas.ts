import { z } from "zod";

export const MARKETING_INTEGRATION_EVENT_KEYS = [
  "sign_up",
  "purchase",
  "lesson_completed",
  "test_submit",
  "trial_enrolment",
  "initiate_transaction",
  "profile_updated",
  "custom_fields",
  "mobile_otp_verification",
] as const;

export type MarketingIntegrationEventKey = (typeof MARKETING_INTEGRATION_EVENT_KEYS)[number];

export const marketingIntegrationEventKeySchema = z.enum(MARKETING_INTEGRATION_EVENT_KEYS);

export const MARKETING_INTEGRATION_EVENT_LABELS: Record<MarketingIntegrationEventKey, string> = {
  sign_up: "Sign Up",
  purchase: "Purchase",
  lesson_completed: "Lesson Completed",
  test_submit: "Test Submit",
  trial_enrolment: "Trial Enrolment",
  initiate_transaction: "Initiate Transaction",
  profile_updated: "Profile Updated",
  custom_fields: "Custom Fields",
  mobile_otp_verification: "Mobile OTP Verification",
};

export const marketingIntegrationSnippetsDtoSchema = z.object({
  siteBodyHtml: z.string().nullable(),
  orderTrackingHtml: z.string().nullable(),
  signupTrackingHtml: z.string().nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const marketingIntegrationSnippetsResponseSchema = z.object({
  data: marketingIntegrationSnippetsDtoSchema,
});

export const updateMarketingIntegrationSnippetsBodySchema = z
  .object({
    siteBodyHtml: z.string().max(100_000).optional().nullable(),
    orderTrackingHtml: z.string().max(100_000).optional().nullable(),
    signupTrackingHtml: z.string().max(100_000).optional().nullable(),
  })
  .strict();

export const marketingIntegrationWebhookDtoSchema = z.object({
  id: z.string().uuid(),
  eventKey: marketingIntegrationEventKeySchema,
  url: z.string().url(),
  enabled: z.boolean(),
  lastTestedAt: z.string().datetime().nullable(),
  lastDeliveryAt: z.string().datetime().nullable(),
  lastDeliveryStatus: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const marketingIntegrationWebhooksListResponseSchema = z.object({
  data: z.object({
    events: z.array(
      z.object({
        key: marketingIntegrationEventKeySchema,
        label: z.string(),
        webhooks: z.array(marketingIntegrationWebhookDtoSchema),
      }),
    ),
  }),
});

export const createMarketingIntegrationWebhookBodySchema = z
  .object({
    eventKey: marketingIntegrationEventKeySchema,
    url: z.string().trim().url().max(2000),
    enabled: z.boolean().optional().default(true),
  })
  .strict();

export const updateMarketingIntegrationWebhookBodySchema = z
  .object({
    url: z.string().trim().url().max(2000).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.url !== undefined || value.enabled !== undefined, {
    message: "Provide url and/or enabled.",
  });

export const marketingIntegrationWebhookResponseSchema = z.object({
  data: marketingIntegrationWebhookDtoSchema,
});

export const deleteMarketingIntegrationWebhookResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const testMarketingIntegrationWebhookResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    ok: z.boolean(),
    statusCode: z.number().int().nullable(),
    message: z.string(),
  }),
});

export const marketingIntegrationCredentialsDtoSchema = z.object({
  schoolId: z.string().uuid(),
  tenantSlug: z.string(),
  apiKeyConfigured: z.boolean(),
  apiKeyPrefix: z.string().nullable(),
  apiKeyCreatedAt: z.string().datetime().nullable(),
});

export const marketingIntegrationCredentialsResponseSchema = z.object({
  data: marketingIntegrationCredentialsDtoSchema,
});

export const rotateMarketingIntegrationApiKeyResponseSchema = z.object({
  data: z.object({
    schoolId: z.string().uuid(),
    tenantSlug: z.string(),
    apiKey: z.string(),
    apiKeyPrefix: z.string(),
    apiKeyCreatedAt: z.string().datetime(),
  }),
});

export const marketingIntegrationOverviewDtoSchema = z.object({
  webhookCount: z.number().int().nonnegative(),
  webhookEnabledCount: z.number().int().nonnegative(),
  webhooksWithDelivery: z.number().int().nonnegative(),
  webhooksLastOkCount: z.number().int().nonnegative(),
  webhooksLastErrorCount: z.number().int().nonnegative(),
  snippetConfiguredCount: z.number().int().min(0).max(3),
  apiKeyConfigured: z.boolean(),
  apiKeyCreatedAt: z.string().datetime().nullable(),
  lastDeliveryAt: z.string().datetime().nullable(),
  health: z.enum(["healthy", "attention", "idle"]),
});

export const marketingIntegrationOverviewResponseSchema = z.object({
  data: marketingIntegrationOverviewDtoSchema,
});

export const marketingIntegrationDeliveryDtoSchema = z.object({
  id: z.string().uuid(),
  webhookId: z.string().uuid(),
  eventKey: marketingIntegrationEventKeySchema,
  url: z.string(),
  ok: z.boolean(),
  statusCode: z.number().int().nullable(),
  message: z.string(),
  requestBody: z.string().nullable(),
  source: z.enum(["dispatch", "test"]),
  createdAt: z.string().datetime(),
});

export const marketingIntegrationDeliveriesListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingIntegrationDeliveryDtoSchema),
  }),
});

export const publicMarketingIntegrationSnippetsResponseSchema = z.object({
  data: z.object({
    siteBodyHtml: z.string().nullable(),
    orderTrackingHtml: z.string().nullable(),
    signupTrackingHtml: z.string().nullable(),
  }),
});

export const integrationSignUpBodySchema = z
  .object({
    email: z.string().trim().email().max(320),
    displayName: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export const integrationSignUpResponseSchema = z.object({
  data: z.object({
    created: z.boolean(),
    email: z.string().email(),
    membershipId: z.string().uuid().nullable(),
  }),
});

export const integrationPaidEnrollmentBodySchema = z
  .object({
    email: z.string().trim().email().max(320),
    productTitle: z.string().trim().min(1).max(300),
  })
  .strict();

export const integrationPaidEnrollmentResponseSchema = z.object({
  data: z.object({
    enrolled: z.boolean(),
    alreadyEnrolled: z.boolean(),
    email: z.string().email(),
    productTitle: z.string(),
    courseId: z.string().uuid(),
    enrollmentId: z.string().uuid(),
  }),
});
