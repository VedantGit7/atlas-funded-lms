import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import {
  describeItemDefinitionIssues,
  isOptionItemType,
  isValidatedItemType,
  validateItemDefinition,
} from "./item-definition.contract";
import type {
  AddCollectionItemInput,
  AddCollectionItemsInput,
  BulkDeleteItemsInput,
  BulkItemStatusInput,
  CreateItemCollectionInput,
  CreateItemInput,
  DeleteCollectionItemInput,
  ListItemCollectionsQuery,
  ListItemsQuery,
  PutDimensionWeightsInput,
  PublishStatusSchema,
  UpdateItemCollectionInput,
  UpdateItemInput,
} from "../item-registry/schemas";
import { BULK_ITEM_STATUS_MAX } from "../item-registry/schemas";
import type { z } from "zod";
import {
  collectionItemConflict,
  duplicateDimensionWeight,
  itemCollectionNotFound,
  itemDefinitionInvalid,
  itemInUse,
  itemCollectionSlugConflict,
  itemNotFound,
  itemTypeNotFound,
} from "./item-registry.errors";
import { decodeExplanationJson, itemRegistryRepository } from "./item-registry.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

type PublishStatus = z.infer<typeof PublishStatusSchema>;
type EntityStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";

function pageFrom<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return {
    data,
    page: {
      hasMore,
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = (error as { code: string }).code;

  if (code === "P2002") {
    return true;
  }

  if (code === "P2010") {
    const meta = (
      error as {
        meta?: { driverAdapterError?: { cause?: { kind?: string } } };
      }
    ).meta;

    return meta?.driverAdapterError?.cause?.kind === "UniqueConstraintViolation";
  }

  return false;
}

function mapItem(
  row: {
    id: string;
    item_type_key: string;
    stem_json: unknown;
    explanation_json: unknown;
    status: string;
    tags: string[];
    created_by_membership_id: string | null;
    created_at: Date;
    updated_at: Date;
  },
  options?: Array<{
    id: string;
    option_json: unknown;
    is_correct: boolean | null;
    position: number;
  }>,
) {
  const decoded = decodeExplanationJson(row.explanation_json);

  return {
    id: row.id,
    itemTypeKey: row.item_type_key,
    contentJson: row.stem_json,
    answerKeyJson: decoded.answerKeyJson,
    status: row.status as PublishStatus,
    tags: Array.isArray(row.tags) ? row.tags : [],
    metadataJson: decoded.metadataJson,
    createdByMembershipId: row.created_by_membership_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    options: options?.map((option) => ({
      id: option.id,
      optionJson: option.option_json,
      isCorrect: option.is_correct ?? null,
      position: option.position,
    })),
  };
}

function mapCollection(row: {
  id: string;
  slug: string;
  title: string;
  collection_type: string;
  status: string;
  metadata_json: unknown;
  created_at: Date;
  updated_at: Date;
  item_count?: number;
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    collectionType: row.collection_type as "deck" | "quiz_bank" | "practice_set",
    status: row.status as PublishStatus,
    metadataJson: row.metadata_json ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    itemCount: row.item_count,
  };
}

async function hydrateItem(tx: TenantTx, itemId: string) {
  const item = await itemRegistryRepository.findItemById(tx, itemId);

  if (!item) {
    throw itemNotFound();
  }

  const options = await itemRegistryRepository.listItemOptions(tx, itemId);
  return mapItem(item, options);
}

type StoredOptionInput = {
  id?: string;
  optionJson: unknown;
  isCorrect?: boolean | null | undefined;
  position: number;
};

/**
 * Validates a question against its type's rules and returns what to store.
 * For multiple choice the options get their ids here, before they are stored,
 * so the answer key names the stored options. Options used to be renumbered
 * on every save while the key kept the editor's ids, which no longer existed:
 * a multi-select question then marked every correct answer wrong.
 */
export function resolveItemDefinition(args: {
  itemTypeKey: string;
  contentJson: unknown;
  answerKeyJson: unknown;
  options: StoredOptionInput[] | null | undefined;
}): { answerKeyJson: unknown; options: StoredOptionInput[] | null } {
  if (!isValidatedItemType(args.itemTypeKey)) {
    return { answerKeyJson: args.answerKeyJson, options: args.options ?? null };
  }

  const content =
    args.contentJson && typeof args.contentJson === "object"
      ? (args.contentJson as Record<string, unknown>)
      : {};
  const result = validateItemDefinition({
    itemTypeKey: args.itemTypeKey,
    stem: content["stem"],
    answerKeyJson: args.answerKeyJson,
    options: args.options,
  });
  if (!result.ok) {
    throw itemDefinitionInvalid(describeItemDefinitionIssues(result.issues));
  }

  if (!result.options) {
    // Types without options keep whatever options the caller sent: graders
    // ignore them, and callers such as practice decks attach their own.
    return { answerKeyJson: result.answerKey, options: args.options ?? null };
  }

  const options = result.options.map((option) => ({ ...option, id: randomUUID() }));
  const correctIds = options.filter((option) => option.isCorrect).map((option) => option.id);
  const answerKeyJson =
    args.itemTypeKey === "mcq_single"
      ? { ...result.answerKey, correctOptionId: correctIds[0] }
      : { ...result.answerKey, correctOptionIds: correctIds };

  return { answerKeyJson, options };
}

/** The canonical key, naming the correct options already stored. */
function answerKeyForStoredOptions(
  itemTypeKey: string,
  answerKeyJson: unknown,
  stored: Array<{ id: string; isCorrect: boolean | null }>,
): Record<string, unknown> {
  const key = {
    ...(answerKeyJson && typeof answerKeyJson === "object"
      ? (answerKeyJson as Record<string, unknown>)
      : {}),
  };
  delete key["correctOptionId"];
  delete key["correctOptionIds"];
  const correctIds = stored.filter((option) => option.isCorrect === true).map((o) => o.id);
  return itemTypeKey === "mcq_single"
    ? { ...key, correctOptionId: correctIds[0] }
    : { ...key, correctOptionIds: correctIds };
}

function auditActor(ctx: ServiceCtx) {
  return {
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    platformPrincipalId: null,
    requestId: ctx.requestId,
  };
}

/**
 * What a learner is marked against (audit M7): the stem, the answer key and
 * which options are correct. Options are replaced on every edit, so they are
 * recorded by position and content rather than by id.
 */
function itemSnapshot(item: ReturnType<typeof mapItem>) {
  return {
    itemTypeKey: item.itemTypeKey,
    status: item.status,
    tags: item.tags,
    contentJson: item.contentJson,
    answerKeyJson: item.answerKeyJson,
    options: (item.options ?? []).map((option) => ({
      position: option.position,
      optionJson: option.optionJson,
      isCorrect: option.isCorrect,
    })),
  };
}

function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter(
    (key) => key !== "updatedAt" && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

async function requireOwnedItem(tx: TenantTx, ctx: ServiceCtx, itemId: string) {
  const item = await itemRegistryRepository.findItemById(tx, itemId);

  if (!item || item.created_by_membership_id !== ctx.actorMembershipId) {
    throw itemNotFound();
  }

  return item;
}

export const itemRegistryService = {
  async listItemTypes(tx: TenantTx) {
    const rows = await itemRegistryRepository.listItemTypes(tx);

    return {
      data: rows.map((row) => ({
        key: row.key,
        name: row.name,
        schemaJson: row.schema_json,
        rendererKey: row.renderer_key,
        isBuiltin: row.is_builtin,
      })),
    };
  },

  async listItems(tx: TenantTx, query: ListItemsQuery) {
    const result = await itemRegistryRepository.listItems(tx, query);
    const page = pageFrom(result.rows, query.limit);

    return {
      data: page.data.map((row) => mapItem(row)),
      page: { ...page.page, total: result.total },
    };
  },

  async createItem(tx: TenantTx, ctx: ServiceCtx, input: CreateItemInput) {
    const itemType = await itemRegistryRepository.findItemTypeByKey(tx, input.itemTypeKey);

    if (!itemType) {
      throw itemTypeNotFound();
    }

    const definition = resolveItemDefinition({
      itemTypeKey: input.itemTypeKey,
      contentJson: input.contentJson,
      answerKeyJson: input.answerKeyJson,
      options: input.options,
    });

    const item = await itemRegistryRepository.createItem(tx, {
      tenantId: ctx.tenantId,
      itemTypeKey: input.itemTypeKey,
      contentJson: input.contentJson,
      answerKeyJson: definition.answerKeyJson,
      tags: input.tags,
      metadataJson: input.metadataJson,
      createdByMembershipId: ctx.actorMembershipId,
    });

    if (definition.options && definition.options.length > 0) {
      await itemRegistryRepository.replaceItemOptions(
        tx,
        ctx.tenantId,
        item.id,
        definition.options,
      );
    }

    const created = await hydrateItem(tx, item.id);
    await auditWriter.write(tx, auditActor(ctx), {
      action: "item.created",
      target: { type: "item", id: item.id },
      before: null,
      after: itemSnapshot(created),
      metadata: {},
    });

    return { data: created };
  },

  async getItem(tx: TenantTx, itemId: string) {
    return { data: await hydrateItem(tx, itemId) };
  },

  async updateItem(tx: TenantTx, ctx: ServiceCtx, itemId: string, input: UpdateItemInput) {
    const existing = await requireOwnedItem(tx, ctx, itemId);
    const current = await hydrateItem(tx, itemId);
    const before = itemSnapshot(current);

    const updateData: Parameters<typeof itemRegistryRepository.updateItem>[2] = {
      existingExplanationJson: existing.explanation_json,
    };

    // A change to the question, its answer or its options is checked as a
    // whole question: the result must still be gradeable. Status, tags and
    // metadata changes alone are not, so an older question can still be
    // archived or retagged.
    let optionsToStore: StoredOptionInput[] | null = null;
    if (
      input.contentJson !== undefined ||
      input.answerKeyJson !== undefined ||
      input.options !== undefined
    ) {
      const optionsChanged = input.options !== undefined;
      const definition = resolveItemDefinition({
        itemTypeKey: current.itemTypeKey,
        contentJson: input.contentJson ?? current.contentJson,
        answerKeyJson: input.answerKeyJson ?? current.answerKeyJson,
        options: input.options ?? current.options ?? [],
      });
      updateData.answerKeyJson = definition.answerKeyJson;
      // Unchanged options keep their ids, so the key must name those, not
      // fresh ones.
      if (!optionsChanged && definition.options && isOptionItemType(current.itemTypeKey)) {
        updateData.answerKeyJson = answerKeyForStoredOptions(
          current.itemTypeKey,
          definition.answerKeyJson,
          current.options ?? [],
        );
      }
      if (optionsChanged) optionsToStore = definition.options ?? [];
    }

    if (input.contentJson !== undefined) updateData.contentJson = input.contentJson;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.metadataJson !== undefined) updateData.metadataJson = input.metadataJson;
    if (input.status !== undefined) updateData.status = input.status;

    await itemRegistryRepository.updateItem(tx, itemId, updateData);

    if (optionsToStore !== null) {
      await itemRegistryRepository.replaceItemOptions(tx, ctx.tenantId, itemId, optionsToStore);
    }

    // Audit M7: answer-key edits were untraceable, which matters for disputes.
    const updated = await hydrateItem(tx, itemId);
    const after = itemSnapshot(updated);
    const changed = changedKeys(before, after);
    await auditWriter.write(tx, auditActor(ctx), {
      action: "item.updated",
      target: { type: "item", id: itemId },
      before,
      after,
      metadata: {
        changedFields: changed,
        answerKeyChanged: changed.includes("answerKeyJson") || changed.includes("options"),
      },
    });

    return { data: updated };
  },

  /**
   * Publishes, unpublishes or archives many of the author's items at once,
   * at most BULK_ITEM_STATUS_MAX per request (remaining says how many are
   * left). Each change is audited like a single edit.
   */
  async bulkSetItemStatus(tx: TenantTx, ctx: ServiceCtx, input: BulkItemStatusInput) {
    const result = await itemRegistryRepository.bulkSetStatus(tx, {
      status: input.status,
      actorMembershipId: ctx.actorMembershipId,
      max: BULK_ITEM_STATUS_MAX,
      itemIds: input.itemIds ?? null,
      itemTypeKey: input.filter?.itemTypeKey ?? null,
      fromStatus: input.filter?.status ?? null,
      q: input.filter?.q ?? null,
      importBatchId: input.filter?.importBatchId ?? null,
    });

    for (const item of result.changed) {
      await auditWriter.write(tx, auditActor(ctx), {
        action: "item.updated",
        target: { type: "item", id: item.id },
        before: { status: item.status },
        after: { status: input.status },
        metadata: { changedFields: ["status"], answerKeyChanged: false, bulk: true },
      });
    }

    return {
      data: {
        status: input.status,
        updated: result.changed.length,
        remaining: result.remaining,
        skipped: result.skipped,
      },
    };
  },

  /**
   * Deletes many of the author's items at once, at most BULK_ITEM_STATUS_MAX
   * per request (remaining says how many are left). Items in use are kept and
   * counted; each deletion is audited like a single one.
   */
  async bulkDeleteItems(tx: TenantTx, ctx: ServiceCtx, input: BulkDeleteItemsInput) {
    const result = await itemRegistryRepository.bulkDelete(tx, {
      actorMembershipId: ctx.actorMembershipId,
      max: BULK_ITEM_STATUS_MAX,
      itemIds: input.itemIds ?? null,
      itemTypeKey: input.filter?.itemTypeKey ?? null,
      status: input.filter?.status ?? null,
      q: input.filter?.q ?? null,
      importBatchId: input.filter?.importBatchId ?? null,
    });

    for (const item of result.deleted) {
      await auditWriter.write(tx, auditActor(ctx), {
        action: "item.deleted",
        target: { type: "item", id: item.id },
        before: { status: item.status },
        after: { status: "ARCHIVED", deleted: true },
        metadata: { bulk: true },
      });
    }

    return {
      data: {
        deleted: result.deleted.length,
        remaining: result.remaining,
        inUse: result.inUse,
        skipped: result.skipped,
      },
    };
  },

  async deleteItem(tx: TenantTx, ctx: ServiceCtx, itemId: string) {
    const existing = await requireOwnedItem(tx, ctx, itemId);
    if (await itemRegistryRepository.isItemInUse(tx, itemId)) {
      throw itemInUse();
    }

    await itemRegistryRepository.softDeleteItem(tx, itemId);

    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: "item.deleted",
        target: { type: "item", id: itemId },
        before: { status: existing.status },
        after: { status: "ARCHIVED", deleted: true },
        metadata: {},
      },
    );

    return { data: { id: itemId, deleted: true as const } };
  },

  async listDimensionWeights(tx: TenantTx, itemId: string) {
    const item = await itemRegistryRepository.findItemById(tx, itemId);

    if (!item) {
      throw itemNotFound();
    }

    const rows = await itemRegistryRepository.listDimensionWeights(tx, itemId);

    return {
      data: rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        dimensionId: row.dimension_id,
        weight: row.weight.toString(),
      })),
    };
  },

  async putDimensionWeights(
    tx: TenantTx,
    ctx: ServiceCtx,
    itemId: string,
    input: PutDimensionWeightsInput,
  ) {
    const item = await itemRegistryRepository.findItemById(tx, itemId);

    if (!item) {
      throw itemNotFound();
    }

    const dimensionIds = new Set(input.weights.map((weight) => weight.dimensionId));

    if (dimensionIds.size !== input.weights.length) {
      throw duplicateDimensionWeight();
    }

    const weightsOf = (rows: Array<{ dimension_id: string; weight: { toString(): string } }>) =>
      rows
        .map((row) => ({ dimensionId: row.dimension_id, weight: row.weight.toString() }))
        .sort((a, b) => a.dimensionId.localeCompare(b.dimensionId));
    const before = weightsOf(await itemRegistryRepository.listDimensionWeights(tx, itemId));

    await itemRegistryRepository.replaceDimensionWeights(
      tx,
      ctx.tenantId,
      itemId,
      input.weights.map((weight) => ({
        dimensionId: weight.dimensionId,
        weight: weight.weight,
      })),
    );

    await auditWriter.write(tx, auditActor(ctx), {
      action: "item.dimension_weights.replaced",
      target: { type: "item", id: itemId },
      before: { weights: before },
      after: { weights: weightsOf(await itemRegistryRepository.listDimensionWeights(tx, itemId)) },
      metadata: {},
    });

    return this.listDimensionWeights(tx, itemId);
  },

  async listCollections(tx: TenantTx, query: ListItemCollectionsQuery) {
    const result = await itemRegistryRepository.listCollections(tx, query);
    const page = pageFrom(result, query.limit);

    return {
      data: page.data.map(mapCollection),
      page: page.page,
    };
  },

  async createCollection(tx: TenantTx, ctx: ServiceCtx, input: CreateItemCollectionInput) {
    try {
      const collection = await itemRegistryRepository.createCollection(tx, {
        tenantId: ctx.tenantId,
        slug: input.slug,
        title: input.title,
        collectionType: input.collectionType,
        metadataJson: input.metadataJson,
      });

      const created = mapCollection({ ...collection, item_count: 0 });
      await auditWriter.write(tx, auditActor(ctx), {
        action: "item_collection.created",
        target: { type: "item_collection", id: collection.id },
        before: null,
        after: created,
        metadata: {},
      });

      return { data: created };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw itemCollectionSlugConflict();
      }

      throw error;
    }
  },

  async updateCollection(
    tx: TenantTx,
    ctx: ServiceCtx,
    collectionId: string,
    input: UpdateItemCollectionInput,
  ) {
    const existing = await itemRegistryRepository.findCollectionById(tx, collectionId);

    if (!existing) {
      throw itemCollectionNotFound();
    }

    try {
      const updateData: Parameters<typeof itemRegistryRepository.updateCollection>[2] = {};
      if (input.slug !== undefined) updateData.slug = input.slug;
      if (input.title !== undefined) updateData.title = input.title;
      if (input.collectionType !== undefined) updateData.collectionType = input.collectionType;
      if (input.metadataJson !== undefined) updateData.metadataJson = input.metadataJson;
      if (input.status !== undefined) updateData.status = input.status;

      const collection = await itemRegistryRepository.updateCollection(
        tx,
        collectionId,
        updateData,
      );

      const updated = mapCollection(collection);
      const before = mapCollection(existing);
      await auditWriter.write(tx, auditActor(ctx), {
        action: "item_collection.updated",
        target: { type: "item_collection", id: collectionId },
        before,
        after: updated,
        metadata: { changedFields: changedKeys(before, updated) },
      });

      return { data: updated };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw itemCollectionSlugConflict();
      }

      throw error;
    }
  },

  async deleteCollection(tx: TenantTx, ctx: ServiceCtx, collectionId: string) {
    const existing = await itemRegistryRepository.findCollectionById(tx, collectionId);

    if (!existing) {
      throw itemCollectionNotFound();
    }

    await itemRegistryRepository.softDeleteCollection(tx, collectionId);

    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: "item_collection.deleted",
        target: { type: "item_collection", id: collectionId },
        before: { status: existing.status, slug: existing.slug },
        after: { status: "ARCHIVED", deleted: true },
        metadata: {},
      },
    );

    return { data: { id: collectionId, deleted: true as const } };
  },

  async addItemToCollection(
    tx: TenantTx,
    ctx: ServiceCtx,
    collectionId: string,
    input: AddCollectionItemInput,
  ) {
    const collection = await itemRegistryRepository.findCollectionById(tx, collectionId);

    if (!collection) {
      throw itemCollectionNotFound();
    }

    const item = await itemRegistryRepository.findItemById(tx, input.itemId);

    if (!item) {
      throw itemNotFound();
    }

    try {
      const position =
        input.position ??
        (await itemRegistryRepository.maxCollectionPosition(tx, collectionId)) + 1;
      const row = await itemRegistryRepository.addItemToCollection(tx, {
        tenantId: ctx.tenantId,
        collectionId,
        itemId: input.itemId,
        position,
        ...(input.weight !== undefined ? { weight: input.weight } : {}),
      });

      await auditWriter.write(tx, auditActor(ctx), {
        action: "item_collection.item_added",
        target: { type: "item_collection", id: collectionId },
        before: null,
        after: {
          itemId: row.item_id,
          position: row.position,
          weight: row.weight?.toString() ?? null,
        },
        metadata: {},
      });

      return {
        data: {
          id: row.id,
          collectionId: row.collection_id,
          itemId: row.item_id,
          position: row.position,
          weight: row.weight?.toString() ?? null,
        },
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw collectionItemConflict("Item or position already exists in this collection.");
      }

      throw error;
    }
  },

  /**
   * Adds many questions at the end of a collection, in the order sent (QA
   * review 1 C8: the picker adds in bulk). Questions already in the
   * collection, repeated in the request, or no longer in the bank are skipped.
   */
  async addItemsToCollection(
    tx: TenantTx,
    ctx: ServiceCtx,
    collectionId: string,
    input: AddCollectionItemsInput,
  ) {
    const collection = await itemRegistryRepository.findCollectionById(tx, collectionId);
    if (!collection) {
      throw itemCollectionNotFound();
    }

    const present = new Set(
      (await itemRegistryRepository.listCollectionItems(tx, collectionId)).map(
        (row) => row.item_id,
      ),
    );
    const requested = [...new Set(input.itemIds)];
    const existing = await itemRegistryRepository.listCollectionItemSummaries(tx, requested);
    const toAdd = requested.filter((id) => !present.has(id) && existing.has(id));

    let position = await itemRegistryRepository.maxCollectionPosition(tx, collectionId);
    const added = [];
    for (const itemId of toAdd) {
      position += 1;
      let row;
      try {
        row = await itemRegistryRepository.addItemToCollection(tx, {
          tenantId: ctx.tenantId,
          collectionId,
          itemId,
          position,
        });
      } catch (error) {
        // Someone else added to this collection at the same moment.
        if (isUniqueViolation(error)) {
          throw collectionItemConflict("This collection changed while adding. Try again.");
        }
        throw error;
      }
      added.push({
        id: row.id,
        collectionId: row.collection_id,
        itemId: row.item_id,
        position: row.position,
        weight: row.weight?.toString() ?? null,
        item: existing.get(itemId) ?? null,
      });
    }

    if (added.length > 0) {
      await auditWriter.write(tx, auditActor(ctx), {
        action: "item_collection.item_added",
        target: { type: "item_collection", id: collectionId },
        before: null,
        after: {
          itemIds: added.map((entry) => entry.itemId),
          positions: added.map((entry) => entry.position),
        },
        metadata: { bulk: true, skipped: input.itemIds.length - added.length },
      });
    }

    return { data: { added, skipped: input.itemIds.length - added.length } };
  },

  async removeItemFromCollection(
    tx: TenantTx,
    ctx: ServiceCtx,
    collectionId: string,
    input: DeleteCollectionItemInput,
  ) {
    const collection = await itemRegistryRepository.findCollectionById(tx, collectionId);

    if (!collection) {
      throw itemCollectionNotFound();
    }

    const removed = (await itemRegistryRepository.listCollectionItems(tx, collectionId)).find(
      (row) => row.item_id === input.itemId,
    );
    await itemRegistryRepository.removeItemFromCollection(tx, collectionId, input.itemId);

    await auditWriter.write(tx, auditActor(ctx), {
      action: "item_collection.item_removed",
      target: { type: "item_collection", id: collectionId },
      before: removed
        ? {
            itemId: removed.item_id,
            position: removed.position,
            weight: removed.weight?.toString() ?? null,
          }
        : { itemId: input.itemId },
      after: null,
      metadata: {},
    });

    return {
      data: {
        collectionId,
        itemId: input.itemId,
        removed: true as const,
      },
    };
  },

  async listCollectionItems(tx: TenantTx, collectionId: string) {
    const collection = await itemRegistryRepository.findCollectionById(tx, collectionId);

    if (!collection) {
      throw itemCollectionNotFound();
    }

    const rows = await itemRegistryRepository.listCollectionItems(tx, collectionId);
    const summaries = await itemRegistryRepository.listCollectionItemSummaries(
      tx,
      rows.map((row) => row.item_id),
    );

    return {
      data: rows.map((row) => ({
        id: row.id,
        collectionId: row.collection_id,
        itemId: row.item_id,
        position: row.position,
        weight: row.weight?.toString() ?? null,
        item: summaries.get(row.item_id) ?? null,
      })),
    };
  },
};

export type { EntityStatus };
