import { z } from "zod";

export const promoSliderStatusSchema = z.enum(["DRAFT", "LIVE", "UNPUBLISHED"]);
export const promoSlideImageFitSchema = z.enum(["COVER", "CONTAIN", "FILL"]);

export const promoSlideDtoSchema = z.object({
  id: z.string().uuid(),
  sliderId: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  imageFit: promoSlideImageFitSchema,
  linkUrl: z.string().nullable(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const promoSliderDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: promoSliderStatusSchema,
  slideCount: z.number().int().nonnegative(),
  slides: z.array(promoSlideDtoSchema),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const promoSliderListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: promoSliderStatusSchema,
  slideCount: z.number().int().nonnegative(),
  thumbnailUrl: z.string().nullable(),
  primaryLinkUrl: z.string().nullable(),
  hasSchedule: z.boolean(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const promoSlidersListQuerySchema = z
  .object({
    status: z.enum(["ALL", "DRAFT", "LIVE", "UNPUBLISHED"]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const promoSlidersListResponseSchema = z.object({
  data: z.object({
    items: z.array(promoSliderListItemSchema),
    summary: z.object({
      liveCount: z.number().int().nonnegative(),
      draftCount: z.number().int().nonnegative(),
      unpublishedCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
      totalSlides: z.number().int().nonnegative(),
      scheduledSliderCount: z.number().int().nonnegative(),
    }),
  }),
});

export const promoSliderResponseSchema = z.object({ data: promoSliderDtoSchema });

export const createPromoSliderBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const updatePromoSliderBasicsBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
  })
  .strict();

export const upsertPromoSlideBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    imageUrl: z.union([z.string().trim().url().max(2000), z.literal(""), z.null()]).optional(),
    imageFit: promoSlideImageFitSchema.optional().default("COVER"),
    linkUrl: z.union([z.string().trim().url().max(2000), z.literal(""), z.null()]).optional(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    sortOrder: z.number().int().min(0).max(500).optional(),
  })
  .strict();

export const replacePromoSlidesBodySchema = z
  .object({
    slides: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            name: z.string().trim().min(1).max(200),
            imageUrl: z
              .union([z.string().trim().url().max(2000), z.literal(""), z.null()])
              .optional(),
            imageFit: promoSlideImageFitSchema.optional().default("COVER"),
            linkUrl: z
              .union([z.string().trim().url().max(2000), z.literal(""), z.null()])
              .optional(),
            startsAt: z.string().datetime().optional().nullable(),
            endsAt: z.string().datetime().optional().nullable(),
            sortOrder: z.number().int().min(0).max(500),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const deletePromoSliderBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deletePromoSliderResponseSchema = z.object({
  data: z.object({ id: z.string().uuid(), deleted: z.literal(true) }),
});

export const publicPromoSlideDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  imageFit: promoSlideImageFitSchema,
  linkUrl: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
});

export const publicPromoSlidesResponseSchema = z.object({
  data: z.object({
    sliderId: z.string().uuid().nullable(),
    items: z.array(publicPromoSlideDtoSchema),
  }),
});
