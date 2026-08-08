import { z } from "zod";

/**
 * Learner resource library contracts.
 *
 * A "resource" is a real supplementary asset attached to a published lesson the
 * learner is enrolled in: a stored file (PDF / document / video) or an external
 * link / video. Every field is derived from real data (lesson_assets +
 * storage_references + the parent course), so nothing is fabricated.
 */

export const resourceKindSchema = z.enum(["pdf", "video", "link", "document"]);

export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const resourceSortSchema = z.enum(["recent", "name", "size"]);

export type ResourceSort = z.infer<typeof resourceSortSchema>;

export const resourceListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(48).default(24),
    cursor: z.string().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    /** Comma-separated resource kinds (pdf,video,link,document). */
    kinds: z.string().trim().min(1).max(120).optional(),
    /** Comma-separated category labels. */
    categories: z.string().trim().min(1).max(400).optional(),
    sort: resourceSortSchema.default("recent"),
  })
  .strict();

export type ResourceListQuery = z.output<typeof resourceListQuerySchema>;

export const resourceItemSchema = z.object({
  id: z.string().uuid(),
  kind: resourceKindSchema,
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  contentType: z.string().nullable(),
  createdAt: z.string(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  lessonId: z.string().uuid(),
  lessonTitle: z.string(),
  /** Signed download URL (stored files) or the external URL (links/videos). */
  href: z.string().nullable(),
  /** True when the action opens an external destination in a new tab. */
  external: z.boolean(),
});

export type ResourceItem = z.infer<typeof resourceItemSchema>;

export const resourcePageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

export const resourceFacetsSchema = z.object({
  categories: z.array(z.string()),
  kinds: z.array(resourceKindSchema),
});

export const resourceListResponseSchema = z.object({
  data: z.object({
    items: z.array(resourceItemSchema),
    pageInfo: resourcePageInfoSchema,
    facets: resourceFacetsSchema,
    total: z.number().int().nonnegative(),
  }),
});

export type ResourceListResponse = z.output<typeof resourceListResponseSchema>;
