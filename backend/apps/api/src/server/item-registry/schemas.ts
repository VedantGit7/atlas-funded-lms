import { z } from "zod";

export const IdSchema = z.uuid();

export const PublishStatusSchema = z.enum(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]);

export const ItemTypeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_.-]+$/);

export const ItemContentSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length > 0, {
    message: "content_json cannot be empty",
  });

export const ItemAnswerKeySchema = z.record(z.string(), z.unknown()).optional();

export const TagsSchema = z.array(z.string().trim().min(1).max(64)).max(50).default([]);

export const ItemOptionInputSchema = z.object({
  optionJson: z.record(z.string(), z.unknown()),
  isCorrect: z.boolean().nullable().optional(),
  position: z.number().int().min(1).max(500),
});

export const CreateItemBodySchema = z.object({
  itemTypeKey: ItemTypeKeySchema,
  contentJson: ItemContentSchema,
  answerKeyJson: ItemAnswerKeySchema,
  options: z.array(ItemOptionInputSchema).max(100).default([]),
  tags: TagsSchema,
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateItemBodySchema = z.object({
  contentJson: ItemContentSchema.optional(),
  answerKeyJson: ItemAnswerKeySchema,
  options: z.array(ItemOptionInputSchema).max(100).optional(),
  tags: TagsSchema.optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
  status: PublishStatusSchema.optional(),
});

export const ListItemsQuerySchema = z.object({
  itemTypeKey: ItemTypeKeySchema.optional(),
  status: PublishStatusSchema.optional(),
  /** Matches the question text, a tag or your reference, ignoring case. */
  q: z.string().trim().max(120).optional(),
  /** Only the questions one import added. */
  importBatchId: IdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  /** The last item id of the previous page (page.nextCursor). */
  cursor: IdSchema.optional(),
});

/** At most this many items change status in one request. */
export const BULK_ITEM_STATUS_MAX = 500;

/** The Item Bank list filters, for acting on every item they match. */
export const ItemFilterSchema = z
  .object({
    itemTypeKey: ItemTypeKeySchema.optional(),
    status: PublishStatusSchema.optional(),
    q: z.string().trim().max(120).optional(),
    importBatchId: IdSchema.optional(),
  })
  .strict();

/**
 * Change the status of many items at once: the items listed, or the items
 * matching a list filter. A filter request changes at most
 * BULK_ITEM_STATUS_MAX items and reports how many are left, so the caller
 * repeats it until none remain.
 */
export const BulkItemStatusBodySchema = z
  .object({
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    itemIds: z.array(IdSchema).min(1).max(BULK_ITEM_STATUS_MAX).optional(),
    filter: ItemFilterSchema.optional(),
  })
  .strict()
  .refine((body) => (body.itemIds === undefined) !== (body.filter === undefined), {
    message: "Send either itemIds or filter.",
    path: ["itemIds"],
  });

/**
 * Delete many items at once: the items listed, or the items matching a list
 * filter, at most BULK_ITEM_STATUS_MAX per request (repeat while remaining > 0).
 * An item in use (a collection or deck, an assessment, practice answers or
 * review history) is never deleted; archive it instead.
 */
export const BulkDeleteItemsBodySchema = z
  .object({
    itemIds: z.array(IdSchema).min(1).max(BULK_ITEM_STATUS_MAX).optional(),
    filter: ItemFilterSchema.optional(),
  })
  .strict()
  .refine((body) => (body.itemIds === undefined) !== (body.filter === undefined), {
    message: "Send either itemIds or filter.",
    path: ["itemIds"],
  });

export const ItemParamsSchema = z.object({
  id: IdSchema,
});

export const DimensionWeightInputSchema = z.object({
  dimensionId: IdSchema,
  weight: z.coerce.number().min(0).max(1),
});

export const PutDimensionWeightsBodySchema = z.object({
  weights: z.array(DimensionWeightInputSchema).max(50),
});

export const CollectionTypeSchema = z.enum(["deck", "quiz_bank", "practice_set"]);

export const CreateItemCollectionBodySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(180),
  collectionType: CollectionTypeSchema,
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateItemCollectionBodySchema = CreateItemCollectionBodySchema.partial().extend({
  status: PublishStatusSchema.optional(),
});

export const ListItemCollectionsQuerySchema = z.object({
  collectionType: CollectionTypeSchema.optional(),
  status: PublishStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export const ItemCollectionParamsSchema = z.object({
  id: IdSchema,
});

export const AddCollectionItemBodySchema = z.object({
  itemId: IdSchema,
  /** Leave out to add the question at the end (QA review 1 C8). */
  position: z.number().int().min(1).max(1000).optional(),
  weight: z.coerce.number().min(0).max(9999).optional(),
});

/** At most this many questions are added to a collection in one request. */
export const COLLECTION_BULK_ADD_MAX = 100;

/**
 * Add many questions to a collection at once, at the end, in this order
 * (QA review 1 C8). Questions already in it, or no longer in the bank, are
 * skipped and counted.
 */
export const AddCollectionItemsBodySchema = z.object({
  itemIds: z.array(IdSchema).min(1).max(COLLECTION_BULK_ADD_MAX),
});

export const DeleteCollectionItemBodySchema = z.object({
  itemId: IdSchema,
});

export type CreateItemInput = z.infer<typeof CreateItemBodySchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemBodySchema>;
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;
export type BulkItemStatusInput = z.infer<typeof BulkItemStatusBodySchema>;
export type BulkDeleteItemsInput = z.infer<typeof BulkDeleteItemsBodySchema>;
export type PutDimensionWeightsInput = z.infer<typeof PutDimensionWeightsBodySchema>;
export type CreateItemCollectionInput = z.infer<typeof CreateItemCollectionBodySchema>;
export type UpdateItemCollectionInput = z.infer<typeof UpdateItemCollectionBodySchema>;
export type ListItemCollectionsQuery = z.infer<typeof ListItemCollectionsQuerySchema>;
export type AddCollectionItemInput = z.infer<typeof AddCollectionItemBodySchema>;
export type AddCollectionItemsInput = z.infer<typeof AddCollectionItemsBodySchema>;
export type DeleteCollectionItemInput = z.infer<typeof DeleteCollectionItemBodySchema>;
