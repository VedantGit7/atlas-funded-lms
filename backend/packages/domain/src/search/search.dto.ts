import { z } from "zod";

const rejectClientTenantFields = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
    filter: z.never().optional(),
    sort: z.never().optional(),
    offset: z.never().optional(),
    source_context: z.never().optional(),
    sourceContext: z.never().optional(),
  })
  .loose();

export const SEARCH_SOURCE_TYPES = ["course", "post", "certificate"] as const;

export const searchQuerySchema = rejectClientTenantFields
  .extend({
    q: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    type: z.enum(SEARCH_SOURCE_TYPES).optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.q !== undefined && value.q.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Query must be at least 2 characters when provided.",
        path: ["q"],
      });
    }
  });

export const searchResultItemSchema = z
  .object({
    type: z.enum(SEARCH_SOURCE_TYPES),
    title: z.string(),
    snippet: z.string(),
    actionPath: z
      .string()
      .min(1)
      .refine((path) => path.startsWith("/") && !path.includes("://"), {
        message: "actionPath must be an internal relative path",
      }),
  })
  .strict();

export const searchListResponseSchema = z.object({
  data: z.object({
    items: z.array(searchResultItemSchema),
    pageInfo: z.object({
      nextCursor: z.uuid().nullable(),
      hasNextPage: z.boolean(),
    }),
  }),
});

export const searchReindexResponseSchema = z.object({
  data: z.object({
    queued: z.literal(true),
    eventType: z.literal("search.reindex_requested"),
  }),
});

export type SearchQuery = z.output<typeof searchQuerySchema>;
