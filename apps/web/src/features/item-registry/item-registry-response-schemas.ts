import { z } from "zod";
import { CollectionTypeSchema, ItemTypeKeySchema, PublishStatusSchema } from "./schemas";

export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const itemTypeDtoSchema = z.object({
  key: z.string(),
  name: z.string(),
  schemaJson: z.unknown(),
  rendererKey: z.string(),
  isBuiltin: z.boolean(),
});

export const itemTypeListResponseSchema = z.object({
  data: z.array(itemTypeDtoSchema),
});

export const itemOptionDtoSchema = z.object({
  id: z.string().uuid(),
  optionJson: z.unknown(),
  isCorrect: z.boolean().nullable(),
  position: z.number().int(),
});

export const itemDtoSchema = z.object({
  id: z.string().uuid(),
  itemTypeKey: ItemTypeKeySchema,
  contentJson: z.unknown(),
  answerKeyJson: z.unknown().nullable(),
  status: PublishStatusSchema,
  tags: z.array(z.string()),
  metadataJson: z.unknown().nullable(),
  createdByMembershipId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  options: z.array(itemOptionDtoSchema).optional(),
});

export const itemListResponseSchema = z.object({
  data: z.array(itemDtoSchema),
  page: pageInfoSchema,
});

export const itemDetailResponseSchema = z.object({
  data: itemDtoSchema,
});

export const itemDeleteResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export const dimensionWeightDtoSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  dimensionId: z.string().uuid(),
  weight: z.string(),
});

export const dimensionWeightListResponseSchema = z.object({
  data: z.array(dimensionWeightDtoSchema),
});

export const itemCollectionDtoSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  collectionType: CollectionTypeSchema,
  status: PublishStatusSchema,
  metadataJson: z.unknown().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  itemCount: z.number().int().optional(),
});

export const itemCollectionListResponseSchema = z.object({
  data: z.array(itemCollectionDtoSchema),
  page: pageInfoSchema,
});

export const itemCollectionDetailResponseSchema = z.object({
  data: itemCollectionDtoSchema,
});

export const itemCollectionDeleteResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    deleted: z.literal(true),
  }),
});

export const collectionItemDtoSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid(),
  itemId: z.string().uuid(),
  position: z.number().int(),
  weight: z.string().nullable(),
});

export const collectionItemResponseSchema = z.object({
  data: collectionItemDtoSchema,
});

export const collectionItemRemoveResponseSchema = z.object({
  data: z.object({
    collectionId: z.string().uuid(),
    itemId: z.string().uuid(),
    removed: z.literal(true),
  }),
});
