import { z } from "zod";

export const WA_CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "SENT"] as const;
export const WA_AUDIENCE_TYPES = ["ALL", "GROUP"] as const;
export const WA_TEMPLATE_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"] as const;
export const WA_HEADER_TYPES = ["NONE", "TEXT", "IMAGE"] as const;

export const whatsappConnectionDtoSchema = z.object({
  status: z.enum(["DISCONNECTED", "CONNECTED"]),
  providerMode: z.enum(["mock", "meta"]),
  displayName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  phoneNumberId: z.string().nullable(),
  wabaId: z.string().nullable(),
  accessTokenLast4: z.string().nullable(),
  qualityRating: z.string().nullable(),
  messagingLimit: z.number().int(),
  connectedAt: z.string().datetime().nullable(),
  hasCredentials: z.boolean(),
});

export const whatsappConnectionResponseSchema = z.object({
  data: whatsappConnectionDtoSchema,
});

export const connectWhatsappMockBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    phoneNumber: z.string().trim().min(8).max(20),
  })
  .strict();

export const connectWhatsappMetaBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    phoneNumber: z.string().trim().min(8).max(20),
    phoneNumberId: z.string().trim().min(1).max(64),
    wabaId: z.string().trim().min(1).max(64),
    accessToken: z.string().trim().min(20).max(2000),
  })
  .strict();

export const whatsappTemplateButtonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "URL"]),
  text: z.string().trim().min(1).max(25),
  url: z.string().url().max(1000).optional(),
});

export const whatsappTemplateDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  language: z.string(),
  headerType: z.enum(WA_HEADER_TYPES),
  headerText: z.string().nullable(),
  headerImageUrl: z.string().nullable(),
  body: z.string(),
  footer: z.string().nullable(),
  buttons: z.array(whatsappTemplateButtonSchema),
  status: z.enum(WA_TEMPLATE_STATUSES),
  metaTemplateId: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const whatsappTemplatesListResponseSchema = z.object({
  data: z.object({ items: z.array(whatsappTemplateDtoSchema) }),
});

export const whatsappTemplateResponseSchema = z.object({ data: whatsappTemplateDtoSchema });

export const createWhatsappTemplateBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[a-z0-9_]+$/, "Template name must be lowercase letters, numbers, and underscores."),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("MARKETING"),
    language: z.string().trim().min(2).max(16).default("en"),
    headerType: z.enum(WA_HEADER_TYPES).default("NONE"),
    headerText: z.string().trim().max(60).optional().nullable(),
    headerImageUrl: z.string().url().max(2000).optional().nullable(),
    body: z.string().trim().min(1).max(1024),
    footer: z.string().trim().max(60).optional().nullable(),
    buttons: z.array(whatsappTemplateButtonSchema).max(3).optional().default([]),
  })
  .strict();

export const whatsappCampaignDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(WA_CAMPAIGN_STATUSES),
  audienceType: z.enum(WA_AUDIENCE_TYPES).nullable(),
  audienceBatchId: z.string().uuid().nullable(),
  audienceLabel: z.string().nullable(),
  templateId: z.string().uuid().nullable(),
  templateName: z.string().nullable(),
  templateBody: z.string().nullable(),
  recipientCount: z.number().int().nonnegative(),
  deliveredCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  scheduledAt: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const whatsappCampaignsListQuerySchema = z
  .object({
    status: z.enum(["ALL", ...WA_CAMPAIGN_STATUSES]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    createdOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const whatsappCampaignsListResponseSchema = z.object({
  data: z.object({ items: z.array(whatsappCampaignDtoSchema) }),
});

export const whatsappCampaignResponseSchema = z.object({ data: whatsappCampaignDtoSchema });

export const createWhatsappCampaignBodySchema = z
  .object({ title: z.string().trim().min(1).max(200) })
  .strict();

export const updateWhatsappCampaignTitleBodySchema = createWhatsappCampaignBodySchema;

export const setWhatsappCampaignAudienceBodySchema = z
  .object({
    audienceType: z.enum(WA_AUDIENCE_TYPES),
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

export const selectWhatsappTemplateBodySchema = z
  .object({ templateId: z.string().uuid() })
  .strict();

export const sendWhatsappCampaignBodySchema = z
  .object({
    mode: z.enum(["now", "schedule", "test"]),
    scheduledAt: z.string().datetime().optional(),
    testPhone: z.string().trim().min(8).max(20).optional(),
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
    if (value.mode === "test" && !value.testPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "testPhone is required when mode is test.",
        path: ["testPhone"],
      });
    }
  });

export const deleteWhatsappCampaignBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteWhatsappCampaignResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const whatsappRecipientsResponseSchema = z.object({
  data: z.object({
    totalCount: z.number().int().nonnegative(),
    withPhoneCount: z.number().int().nonnegative(),
    items: z.array(
      z.object({
        membershipId: z.string().uuid(),
        displayName: z.string().nullable(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
      }),
    ),
  }),
});

export const whatsappConversationDtoSchema = z.object({
  id: z.string().uuid(),
  waPhone: z.string(),
  membershipId: z.string().uuid().nullable(),
  learnerName: z.string().nullable(),
  lastMessageAt: z.string().datetime(),
  unreadCount: z.number().int().nonnegative(),
  lastMessagePreview: z.string().nullable(),
});

export const whatsappConversationsListResponseSchema = z.object({
  data: z.object({ items: z.array(whatsappConversationDtoSchema) }),
});

export const whatsappInboxMessageDtoSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["IN", "OUT"]),
  body: z.string(),
  status: z.string(),
  createdAt: z.string().datetime(),
});

export const whatsappConversationDetailResponseSchema = z.object({
  data: z.object({
    conversation: whatsappConversationDtoSchema,
    messages: z.array(whatsappInboxMessageDtoSchema),
  }),
});

export const replyWhatsappInboxBodySchema = z
  .object({ body: z.string().trim().min(1).max(4096) })
  .strict();

export const simulateWhatsappInboundBodySchema = z
  .object({
    waPhone: z.string().trim().min(8).max(20),
    body: z.string().trim().min(1).max(4096),
    learnerName: z.string().trim().max(120).optional(),
  })
  .strict();
