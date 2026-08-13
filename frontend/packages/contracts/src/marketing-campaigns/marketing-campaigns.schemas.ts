import { z } from "zod";

export const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "SENT"] as const;
export const CAMPAIGN_GOALS = ["REACTIVATION", "CONVERSION", "ONBOARDING", "RETENTION"] as const;
export const CAMPAIGN_AUDIENCE_TYPES = ["ALL", "GROUP"] as const;
export const CAMPAIGN_CHANNELS = ["email", "push", "announcement", "whatsapp"] as const;

export const campaignTouchpointSchema = z
  .object({
    id: z.string().min(1).max(64),
    channel: z.enum(CAMPAIGN_CHANNELS),
    title: z.string().trim().min(1).max(200),
    subject: z.string().trim().max(500).nullable().optional(),
    body: z.string().trim().max(100_000).nullable().optional(),
    delayDays: z.number().int().min(0).max(365).default(0),
    linkedCampaignId: z.uuid().nullable().optional(),
    linkedStatus: z.enum(CAMPAIGN_STATUSES).nullable().optional(),
  })
  .strict();

export const campaignChannelsSchema = z
  .object({
    email: z.boolean().optional().default(false),
    push: z.boolean().optional().default(false),
    announcement: z.boolean().optional().default(false),
    whatsapp: z.boolean().optional().default(false),
  })
  .strict();

export const marketingCampaignDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  goal: z.enum(CAMPAIGN_GOALS).nullable(),
  status: z.enum(CAMPAIGN_STATUSES),
  audienceType: z.enum(CAMPAIGN_AUDIENCE_TYPES).nullable(),
  audienceBatchId: z.uuid().nullable(),
  audienceLabel: z.string().nullable(),
  recipientCount: z.number().int().nonnegative(),
  channels: campaignChannelsSchema,
  touchpoints: z.array(campaignTouchpointSchema),
  launchedAt: z.iso.datetime().nullable(),
  scheduledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const marketingCampaignsListQuerySchema = z
  .object({
    status: z
      .enum(["ALL", ...CAMPAIGN_STATUSES])
      .optional()
      .default("ALL"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const marketingCampaignsListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingCampaignDtoSchema),
    summary: z.object({
      draftCount: z.number().int().nonnegative(),
      scheduledCount: z.number().int().nonnegative(),
      sentCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
      totalReach: z.number().int().nonnegative(),
    }),
  }),
});

export const marketingCampaignResponseSchema = z.object({
  data: marketingCampaignDtoSchema,
});

export const createMarketingCampaignBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    goal: z.enum(CAMPAIGN_GOALS).optional().nullable(),
  })
  .strict();

export const updateMarketingCampaignIdentityBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    goal: z.enum(CAMPAIGN_GOALS),
  })
  .strict();

export const setMarketingCampaignAudienceBodySchema = z
  .object({
    audienceType: z.enum(CAMPAIGN_AUDIENCE_TYPES),
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

export const updateMarketingCampaignTouchpointsBodySchema = z
  .object({
    channels: campaignChannelsSchema,
    touchpoints: z.array(campaignTouchpointSchema).max(20),
  })
  .strict();

export const launchMarketingCampaignBodySchema = z
  .object({
    mode: z.enum(["now", "schedule"]),
    scheduledAt: z.iso.datetime().optional(),
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
  });

export const deleteMarketingCampaignBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteMarketingCampaignResponseSchema = z.object({
  data: z.object({ id: z.uuid(), deleted: z.literal(true) }),
});

export const marketingCampaignAudienceEstimateQuerySchema = z
  .object({
    audienceType: z.enum(CAMPAIGN_AUDIENCE_TYPES),
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

export const marketingCampaignAudienceEstimateResponseSchema = z.object({
  data: z.object({
    audienceType: z.enum(CAMPAIGN_AUDIENCE_TYPES),
    audienceBatchId: z.uuid().nullable(),
    totalCount: z.number().int().nonnegative(),
  }),
});

export const marketingCampaignAnalyticsDtoSchema = z.object({
  campaignId: z.uuid(),
  title: z.string(),
  status: z.enum(CAMPAIGN_STATUSES),
  goal: z.enum(CAMPAIGN_GOALS).nullable(),
  launchedAt: z.iso.datetime().nullable(),
  audienceLabel: z.string().nullable(),
  totalReach: z.number().int().nonnegative(),
  touchpointCount: z.number().int().nonnegative(),
  channels: z.array(
    z.object({
      channel: z.enum(CAMPAIGN_CHANNELS),
      linkedCampaignId: z.uuid().nullable(),
      title: z.string(),
      status: z.enum(CAMPAIGN_STATUSES).nullable(),
      recipientCount: z.number().int().nonnegative(),
      deliveredCount: z.number().int().nonnegative().nullable(),
      failedCount: z.number().int().nonnegative().nullable(),
      scheduledAt: z.iso.datetime().nullable(),
      sentAt: z.iso.datetime().nullable(),
      href: z.string(),
    }),
  ),
  note: z.string(),
});

export const marketingCampaignAnalyticsResponseSchema = z.object({
  data: marketingCampaignAnalyticsDtoSchema,
});
