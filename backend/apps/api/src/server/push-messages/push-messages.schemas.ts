import { z } from "zod";

export const PUSH_MESSAGE_STATUSES = ["DRAFT", "SCHEDULED", "SENT"] as const;
export const PUSH_AUDIENCE_TYPES = ["ALL", "GROUP"] as const;

export const pushMessageDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(PUSH_MESSAGE_STATUSES),
  audienceType: z.enum(PUSH_AUDIENCE_TYPES).nullable(),
  audienceBatchId: z.string().uuid().nullable(),
  audienceLabel: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  deepLink: z.string().nullable(),
  imageUrl: z.string().nullable(),
  channels: z.object({
    android: z.boolean(),
    ios: z.boolean(),
    web: z.boolean(),
  }),
  recipientCount: z.number().int().nonnegative(),
  scheduledAt: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const pushMessagesListQuerySchema = z
  .object({
    status: z.enum(["ALL", ...PUSH_MESSAGE_STATUSES]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    createdOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const pushMessagesListResponseSchema = z.object({
  data: z.object({
    items: z.array(pushMessageDtoSchema),
    total: z.number().int().nonnegative(),
  }),
});

export const pushMessagesSummaryDtoSchema = z.object({
  draftCount: z.number().int().nonnegative(),
  scheduledCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  totalReach: z.number().int().nonnegative(),
  reach30d: z.number().int().nonnegative(),
  reachTrendPercent: z.number().nullable(),
  channelCoverage: z.object({
    androidPercent: z.number().int().min(0).max(100),
    iosPercent: z.number().int().min(0).max(100),
    webPercent: z.number().int().min(0).max(100),
  }),
  messageCount: z.number().int().nonnegative(),
});

export const pushMessagesSummaryResponseSchema = z.object({
  data: pushMessagesSummaryDtoSchema,
});

export const pushMessageResponseSchema = z.object({ data: pushMessageDtoSchema });

export const createPushMessageBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const updatePushMessageTitleBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const setPushMessageAudienceBodySchema = z
  .object({
    audienceType: z.enum(PUSH_AUDIENCE_TYPES),
    audienceBatchId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.audienceType === "GROUP" && !value.audienceBatchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "audienceBatchId is required when audienceType is GROUP.",
        path: ["audienceBatchId"],
      });
    }
  });

export const composePushMessageBodySchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
    deepLink: z.string().trim().max(1000).optional().nullable(),
    imageUrl: z.string().url().max(2000).optional().nullable(),
    channels: z
      .object({
        android: z.boolean(),
        ios: z.boolean(),
        web: z.boolean(),
      })
      .refine((c) => c.android || c.ios || c.web, {
        message: "Select at least one delivery channel.",
      }),
  })
  .strict();

export const sendPushMessageBodySchema = z
  .object({
    mode: z.enum(["now", "schedule"]),
    scheduledAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "schedule" && !value.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduledAt is required when mode is schedule.",
        path: ["scheduledAt"],
      });
    }
  });

export const deletePushMessageBodySchema = z
  .object({
    titleConfirmation: z.string().trim().min(1).max(200),
  })
  .strict();

export const pushMessageRecipientsResponseSchema = z.object({
  data: z.object({
    totalCount: z.number().int().nonnegative(),
    items: z.array(
      z.object({
        membershipId: z.string().uuid(),
        displayName: z.string().nullable(),
        email: z.string().nullable(),
      }),
    ),
  }),
});

export const deletePushMessageResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const pushAudienceEstimateQuerySchema = z
  .object({
    audienceType: z.enum(PUSH_AUDIENCE_TYPES),
    audienceBatchId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.audienceType === "GROUP" && !value.audienceBatchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "audienceBatchId is required when audienceType is GROUP.",
        path: ["audienceBatchId"],
      });
    }
  });

export const pushAudienceEstimateResponseSchema = z.object({
  data: z.object({
    audienceType: z.enum(PUSH_AUDIENCE_TYPES),
    audienceBatchId: z.string().uuid().nullable(),
    totalCount: z.number().int().nonnegative(),
  }),
});
