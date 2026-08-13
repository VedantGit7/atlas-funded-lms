import { z } from "zod";

export const newsfeedPostTypeSchema = z.enum(["ARTICLE", "PROMO"]);
export const newsfeedPostStatusSchema = z.enum(["DRAFT", "LIVE", "UNPUBLISHED"]);

const stringListSchema = z.array(z.string().trim().min(1).max(80)).max(30);
const optionalUrl = z.union([z.url().max(2000), z.literal(""), z.null()]);

export const newsfeedSettingsDtoSchema = z.object({
  enabled: z.boolean(),
  updatedAt: z.iso.datetime().nullable(),
});

export const newsfeedSettingsResponseSchema = z.object({
  data: newsfeedSettingsDtoSchema,
});

export const updateNewsfeedSettingsBodySchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export const newsfeedPostDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  postType: newsfeedPostTypeSchema,
  status: newsfeedPostStatusSchema,
  bodyHtml: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  authorName: z.string().nullable(),
  tags: z.array(z.string()),
  categories: z.array(z.string()),
  pinned: z.boolean(),
  productId: z.uuid().nullable(),
  productTitle: z.string().nullable(),
  saveCount: z.number().int().nonnegative(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const newsfeedListSummarySchema = z.object({
  liveCount: z.number().int().nonnegative(),
  draftCount: z.number().int().nonnegative(),
  unpublishedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  articleCount: z.number().int().nonnegative(),
  promoCount: z.number().int().nonnegative(),
  pinnedCount: z.number().int().nonnegative(),
  totalSaves: z.number().int().nonnegative(),
});

export const newsfeedPostsListQuerySchema = z
  .object({
    status: z.enum(["ALL", "DRAFT", "LIVE", "UNPUBLISHED"]).optional().default("ALL"),
    postType: z.enum(["ALL", "ARTICLE", "PROMO"]).optional().default("ALL"),
    q: z.string().trim().max(200).optional(),
    productId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const newsfeedPostsListResponseSchema = z.object({
  data: z.object({
    items: z.array(newsfeedPostDtoSchema),
    summary: newsfeedListSummarySchema,
  }),
});

export const newsfeedPostResponseSchema = z.object({ data: newsfeedPostDtoSchema });

export const createNewsfeedPostBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    postType: newsfeedPostTypeSchema,
  })
  .strict();

export const updateNewsfeedPostBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200).optional().nullable(),
    bodyHtml: z.string().max(100_000).optional().nullable(),
    coverImageUrl: optionalUrl.optional(),
    seoTitle: z.string().trim().max(200).optional().nullable(),
    seoDescription: z.string().trim().max(500).optional().nullable(),
    authorName: z.string().trim().max(120).optional().nullable(),
    tags: stringListSchema.optional(),
    categories: stringListSchema.optional(),
    pinned: z.boolean().optional(),
    productId: z.union([z.uuid(), z.literal(""), z.null()]).optional(),
    productTitle: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export const deleteNewsfeedPostBodySchema = z
  .object({ titleConfirmation: z.string().trim().min(1).max(200) })
  .strict();

export const deleteNewsfeedPostResponseSchema = z.object({
  data: z.object({ id: z.uuid(), deleted: z.literal(true) }),
});

export const publicNewsfeedPostDtoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  postType: newsfeedPostTypeSchema,
  bodyHtml: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  authorName: z.string().nullable(),
  tags: z.array(z.string()),
  categories: z.array(z.string()),
  pinned: z.boolean(),
  productId: z.uuid().nullable(),
  productTitle: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  saved: z.boolean().optional(),
});

export const publicNewsfeedFeedResponseSchema = z.object({
  data: z.object({
    enabled: z.boolean(),
    articles: z.array(publicNewsfeedPostDtoSchema),
    promos: z.array(publicNewsfeedPostDtoSchema),
    tags: z.array(z.string()),
    categories: z.array(z.string()),
  }),
});

export const publicNewsfeedPostResponseSchema = z.object({
  data: publicNewsfeedPostDtoSchema,
});

export const publicNewsfeedSettingsResponseSchema = newsfeedSettingsResponseSchema;

export const saveNewsfeedPostResponseSchema = z.object({
  data: z.object({
    postId: z.uuid(),
    saved: z.boolean(),
  }),
});
