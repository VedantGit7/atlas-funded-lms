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
  id: z.uuid(),
  optionJson: z.unknown(),
  isCorrect: z.boolean().nullable(),
  position: z.number().int(),
});

export const itemDtoSchema = z.object({
  id: z.uuid(),
  itemTypeKey: ItemTypeKeySchema,
  contentJson: z.unknown(),
  answerKeyJson: z.unknown().nullable(),
  status: PublishStatusSchema,
  tags: z.array(z.string()),
  metadataJson: z.unknown().nullable(),
  createdByMembershipId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  options: z.array(itemOptionDtoSchema).optional(),
});

export const itemListResponseSchema = z.object({
  data: z.array(itemDtoSchema),
  /** total: every item matching the filters, across all pages. */
  page: pageInfoSchema.extend({ total: z.number().int().nonnegative() }),
});

/**
 * updated: items changed by this request. remaining: items still to change
 * (repeat the request). skipped: items left alone because they belong to
 * another author or no longer exist.
 */
export const bulkItemStatusResponseSchema = z.object({
  data: z.object({
    status: PublishStatusSchema,
    updated: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
});

/**
 * deleted: items removed by this request. remaining: items still to delete
 * (repeat the request). inUse: matching items kept because a collection,
 * deck or assessment uses them or learners have answered them. skipped:
 * items left alone because they belong to another author or no longer exist.
 */
export const bulkDeleteItemsResponseSchema = z.object({
  data: z.object({
    deleted: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    inUse: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
});

export const itemDetailResponseSchema = z.object({
  data: itemDtoSchema,
});

export const itemDeleteResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const dimensionWeightDtoSchema = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
  dimensionId: z.uuid(),
  weight: z.string(),
});

export const dimensionWeightListResponseSchema = z.object({
  data: z.array(dimensionWeightDtoSchema),
});

export const itemCollectionDtoSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  collectionType: CollectionTypeSchema,
  status: PublishStatusSchema,
  metadataJson: z.unknown().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
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
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

/**
 * The question a collection entry points at, so the collection shows its real
 * text and status for any question, not only those on the first page of the
 * bank (QA review 1 C8, M51).
 */
export const collectionItemSummarySchema = z.object({
  stem: z.string().nullable(),
  itemTypeKey: z.string(),
  status: PublishStatusSchema,
});

export const collectionItemDtoSchema = z.object({
  id: z.uuid(),
  collectionId: z.uuid(),
  itemId: z.uuid(),
  position: z.number().int(),
  weight: z.string().nullable(),
  /** Present in collection item lists. */
  item: collectionItemSummarySchema.nullable().optional(),
});

export const collectionItemResponseSchema = z.object({
  data: collectionItemDtoSchema,
});

export const collectionItemRemoveResponseSchema = z.object({
  data: z.object({
    collectionId: z.uuid(),
    itemId: z.uuid(),
    removed: z.literal(true),
  }),
});

export const collectionItemListResponseSchema = z.object({
  data: z.array(collectionItemDtoSchema),
});

/**
 * added: entries created, in the order sent. skipped: questions already in
 * the collection or no longer in the bank.
 */
export const collectionItemsAddResponseSchema = z.object({
  data: z.object({
    added: z.array(collectionItemDtoSchema),
    skipped: z.number().int().nonnegative(),
  }),
});
