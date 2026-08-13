import { z } from "zod";

export const ctaStatusSchema = z.enum(["DRAFT", "LIVE", "UNPUBLISHED"]);
export const ctaTypeSchema = z.enum(["POPUP", "STICKY", "SLIDE_IN", "EMBEDDED_BUTTON"]);
export const ctaAudienceSchema = z.enum(["ALL", "ANONYMOUS", "LEARNERS"]);
export const ctaFrequencySchema = z.enum(["REPEAT", "ONCE"]);
export const ctaTriggerSchema = z.enum(["PAGE_LOAD", "ELAPSED"]);

export const ctaTargetingSchema = z
  .object({
    includeUrls: z.array(z.string().trim().max(2000)).max(50).default([]),
    exceptionUrls: z.array(z.string().trim().max(2000)).max(50).default([]),
    audience: ctaAudienceSchema.default("ALL"),
    frequency: ctaFrequencySchema.default("REPEAT"),
    trigger: ctaTriggerSchema.default("PAGE_LOAD"),
    elapsedSeconds: z.number().int().min(0).max(3600).default(0),
  })
  .strict();

export type CtaTargeting = z.infer<typeof ctaTargetingSchema>;

export const defaultCtaTargeting = (): CtaTargeting =>
  ctaTargetingSchema.parse({
    includeUrls: ["*"],
    exceptionUrls: [],
    audience: "ALL",
    frequency: "REPEAT",
    trigger: "PAGE_LOAD",
    elapsedSeconds: 0,
  });

export const marketingCtaDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  ctaType: ctaTypeSchema,
  status: ctaStatusSchema,
  headline: z.string(),
  bodyHtml: z.string().nullable(),
  imageUrl: z.string().nullable(),
  buttonText: z.string(),
  buttonColor: z.string(),
  buttonTextColor: z.string(),
  backgroundColor: z.string(),
  linkUrl: z.string().nullable(),
  formId: z.uuid().nullable(),
  formTitle: z.string().nullable(),
  formShareToken: z.string().nullable(),
  linkedPopupCtaId: z.uuid().nullable(),
  linkedPopupTitle: z.string().nullable(),
  targeting: ctaTargetingSchema,
  viewCount: z.number().int().nonnegative(),
  clickCount: z.number().int().nonnegative(),
  clickRate: z.number().nonnegative(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const marketingCtasListQuerySchema = z
  .object({
    status: z.enum(["ALL", "DRAFT", "LIVE", "UNPUBLISHED"]).optional().default("ALL"),
    ctaType: z
      .enum(["ALL", "POPUP", "STICKY", "SLIDE_IN", "EMBEDDED_BUTTON"])
      .optional()
      .default("ALL"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const marketingCtasListResponseSchema = z.object({
  data: z.object({
    items: z.array(marketingCtaDtoSchema),
    summary: z.object({
      liveCount: z.number().int().nonnegative(),
      draftCount: z.number().int().nonnegative(),
      unpublishedCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
      totalViews: z.number().int().nonnegative(),
      totalClicks: z.number().int().nonnegative(),
      avgClickRate: z.number().nonnegative(),
      topType: z.enum(["POPUP", "STICKY", "SLIDE_IN", "EMBEDDED_BUTTON"]).nullable(),
    }),
  }),
});

export const marketingCtaResponseSchema = z.object({ data: marketingCtaDtoSchema });

export const createMarketingCtaBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    ctaType: ctaTypeSchema,
    buttonText: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const updateMarketingCtaBasicsBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const updateMarketingCtaDesignBodySchema = z
  .object({
    headline: z.string().trim().max(200),
    bodyHtml: z.string().trim().max(20000).optional().nullable(),
    imageUrl: z.union([z.url().max(2000), z.literal(""), z.null()]).optional(),
    buttonText: z.string().trim().min(1).max(80),
    buttonColor: z.string().trim().min(3).max(32),
    buttonTextColor: z.string().trim().min(3).max(32),
    backgroundColor: z.string().trim().min(3).max(32),
    linkUrl: z.union([z.url().max(2000), z.literal(""), z.null()]).optional(),
    formId: z.uuid().optional().nullable(),
    linkedPopupCtaId: z.uuid().optional().nullable(),
  })
  .strict();

export const updateMarketingCtaTargetingBodySchema = z
  .object({
    targeting: ctaTargetingSchema,
  })
  .strict();

export const deleteMarketingCtaBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteMarketingCtaResponseSchema = z.object({
  data: z.object({ id: z.uuid(), deleted: z.literal(true) }),
});

export const publicMarketingCtaDtoSchema = z.object({
  id: z.uuid(),
  ctaType: ctaTypeSchema,
  headline: z.string(),
  bodyHtml: z.string().nullable(),
  imageUrl: z.string().nullable(),
  buttonText: z.string(),
  buttonColor: z.string(),
  buttonTextColor: z.string(),
  backgroundColor: z.string(),
  linkUrl: z.string().nullable(),
  formShareToken: z.string().nullable(),
  linkedPopupCtaId: z.uuid().nullable(),
  targeting: ctaTargetingSchema,
});

export const publicMarketingCtasListResponseSchema = z.object({
  data: z.object({ items: z.array(publicMarketingCtaDtoSchema) }),
});

export const publicMarketingCtaMetricResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    recorded: z.literal(true),
  }),
});
