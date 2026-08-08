import { z } from "zod";

export const IdSchema = z.string().uuid();

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
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
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
  position: z.number().int().min(1).max(1000),
  weight: z.coerce.number().min(0).max(9999).optional(),
});

export const DeleteCollectionItemBodySchema = z.object({
  itemId: IdSchema,
});

export type CreateItemInput = z.infer<typeof CreateItemBodySchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemBodySchema>;
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;
export type PutDimensionWeightsInput = z.infer<typeof PutDimensionWeightsBodySchema>;
export type CreateItemCollectionInput = z.infer<typeof CreateItemCollectionBodySchema>;
export type UpdateItemCollectionInput = z.infer<typeof UpdateItemCollectionBodySchema>;
export type ListItemCollectionsQuery = z.infer<typeof ListItemCollectionsQuerySchema>;
export type AddCollectionItemInput = z.infer<typeof AddCollectionItemBodySchema>;
export type DeleteCollectionItemInput = z.infer<typeof DeleteCollectionItemBodySchema>;
