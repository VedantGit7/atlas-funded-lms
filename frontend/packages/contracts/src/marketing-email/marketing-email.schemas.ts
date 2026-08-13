import { z } from "zod";

export const MARKETING_EMAIL_STATUSES = ["DRAFT", "SCHEDULED", "SENT"] as const;
export const MARKETING_EMAIL_AUDIENCE_TYPES = ["ALL", "GROUP"] as const;

export const marketingEmailCampaignDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.enum(MARKETING_EMAIL_STATUSES),
  audienceType: z.enum(MARKETING_EMAIL_AUDIENCE_TYPES).nullable(),
  audienceBatchId: z.uuid().nullable(),
  audienceLabel: z.string().nullable(),
  subject: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  templateKey: z.string().nullable(),
  recipientCount: z.number().int().nonnegative(),
  scheduledAt: z.iso.datetime().nullable(),
  sentAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const marketingEmailCampaignsListQuerySchema = z
  .object({
    status: z
      .enum(["ALL", ...MARKETING_EMAIL_STATUSES])
      .optional()
      .default("ALL"),
    q: z.string().trim().max(200).optional(),
    createdOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const marketingEmailCampaignsListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingEmailCampaignDtoSchema),
    total: z.number().int().nonnegative(),
  }),
});

export const marketingEmailCampaignsSummaryDtoSchema = z.object({
  draftCount: z.number().int().nonnegative(),
  scheduledCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  totalReach: z.number().int().nonnegative(),
  reach30d: z.number().int().nonnegative(),
  reachTrendPercent: z.number().nullable(),
  campaignCount: z.number().int().nonnegative(),
});

export const marketingEmailCampaignsSummaryResponseSchema = z.object({
  data: marketingEmailCampaignsSummaryDtoSchema,
});

/** Audience reach preview for the email campaign wizard (shallow estimate route). */
export const marketingEmailAudienceEstimateQuerySchema = z
  .object({
    audienceType: z.enum(MARKETING_EMAIL_AUDIENCE_TYPES),
    audienceBatchId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.audienceType === "GROUP" && !value.audienceBatchId) {
      ctx.addIssue({
        code: "custom",
        message: "audienceBatchId is required when audienceType is GROUP.",
        path: ["audienceBatchId"],
      });
    }
  });

export const marketingEmailAudienceEstimateResponseSchema = z.object({
  data: z.object({
    audienceType: z.enum(MARKETING_EMAIL_AUDIENCE_TYPES),
    audienceBatchId: z.uuid().nullable(),
    totalCount: z.number().int().nonnegative(),
  }),
});

export const marketingEmailCampaignResponseSchema = z.object({
  data: marketingEmailCampaignDtoSchema,
});

export const createMarketingEmailCampaignBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const updateMarketingEmailCampaignTitleBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const setMarketingEmailAudienceBodySchema = z
  .object({
    audienceType: z.enum(MARKETING_EMAIL_AUDIENCE_TYPES),
    audienceBatchId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.audienceType === "GROUP" && !value.audienceBatchId) {
      ctx.addIssue({
        code: "custom",
        message: "audienceBatchId is required when audienceType is GROUP.",
        path: ["audienceBatchId"],
      });
    }
  });

export const composeMarketingEmailBodySchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    bodyHtml: z.string().trim().min(1).max(100_000),
    templateKey: z.string().trim().max(80).optional().nullable(),
  })
  .strict();

export const sendMarketingEmailBodySchema = z
  .object({
    mode: z.enum(["now", "schedule", "test"]),
    scheduledAt: z.iso.datetime().optional(),
    testEmail: z.email().optional(),
    acknowledgeSpam: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "schedule" && !value.scheduledAt) {
      ctx.addIssue({
        code: "custom",
        message: "scheduledAt is required when mode is schedule.",
        path: ["scheduledAt"],
      });
    }
    if (value.mode === "test" && !value.testEmail) {
      ctx.addIssue({
        code: "custom",
        message: "testEmail is required when mode is test.",
        path: ["testEmail"],
      });
    }
  });

export const deleteMarketingEmailBodySchema = z
  .object({
    titleConfirmation: z.string().trim().min(1).max(200),
  })
  .strict();

export const marketingEmailRecipientsResponseSchema = z.object({
  data: z.object({
    totalCount: z.number().int().nonnegative(),
    items: z.array(
      z.object({
        membershipId: z.uuid(),
        displayName: z.string().nullable(),
        email: z.string().nullable(),
      }),
    ),
  }),
});

export const deleteMarketingEmailResponseSchema = z.object({
  data: z.object({ id: z.uuid(), deleted: z.literal(true) }),
});

export const marketingEmailTemplatesResponseSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        description: z.string(),
        subject: z.string(),
        bodyHtml: z.string(),
      }),
    ),
  }),
});

export const spamCheckBodySchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    bodyHtml: z.string().trim().min(1).max(100_000),
  })
  .strict();

export const spamCheckResponseSchema = z.object({
  data: z.object({
    spamDetected: z.boolean(),
    spamWords: z.array(z.string()),
  }),
});

export const sendMarketingEmailResponseSchema = z.object({
  data: marketingEmailCampaignDtoSchema.extend({
    deliveredCount: z.number().int().nonnegative().optional(),
    skippedCount: z.number().int().nonnegative().optional(),
    spamDetected: z.boolean().optional(),
    spamWords: z.array(z.string()).optional(),
  }),
});
