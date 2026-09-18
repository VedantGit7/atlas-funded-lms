// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

type CursorArgs = {
  limit: number;
  cursor?: string | undefined;
};

function takePlusOne(limit: number) {
  return Math.min(limit + 1, 101);
}

export function encodeExplanationJson(args: {
  answerKeyJson?: unknown;
  metadataJson?: unknown;
}): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};

  if (args.answerKeyJson !== undefined) {
    payload["answerKey"] = args.answerKeyJson;
  }

  if (args.metadataJson !== undefined) {
    payload["metadata"] = args.metadataJson;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

export function decodeExplanationJson(explanationJson: unknown): {
  answerKeyJson: unknown;
  metadataJson: unknown;
} {
  if (!explanationJson || typeof explanationJson !== "object" || Array.isArray(explanationJson)) {
    return { answerKeyJson: null, metadataJson: null };
  }

  const value = explanationJson as Record<string, unknown>;

  return {
    answerKeyJson: value["answerKey"] ?? null,
    metadataJson: value["metadata"] ?? null,
  };
}

export const itemRegistryRepository = {
  async listItemTypes(tx: TenantTx) {
    return tx.itemType.findMany({
      orderBy: { key: "asc" },
      select: {
        key: true,
        name: true,
        schema_json: true,
        renderer_key: true,
        is_builtin: true,
      },
    });
  },

  async findItemTypeByKey(tx: TenantTx, key: string) {
    return tx.itemType.findUnique({
      where: { key },
      select: {
        key: true,
        name: true,
        schema_json: true,
        renderer_key: true,
        is_builtin: true,
      },
    });
  },

  async listItems(
    tx: TenantTx,
    args: CursorArgs & {
      itemTypeKey?: string | undefined;
      status?: string | undefined;
      q?: string | undefined;
    },
  ) {
    return tx.item.findMany({
      where: {
        deleted_at: null,
        ...(args.itemTypeKey ? { item_type_key: args.itemTypeKey } : {}),
        ...(args.status ? { status: args.status as never } : {}),
      },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: takePlusOne(args.limit),
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        item_type_key: true,
        stem_json: true,
        explanation_json: true,
        status: true,
        tags: true,
        created_by_membership_id: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async createItem(
    tx: TenantTx,
    data: {
      tenantId: string;
      itemTypeKey: string;
      contentJson: unknown;
      answerKeyJson?: unknown;
      tags: string[];
      metadataJson?: unknown;
      createdByMembershipId: string;
    },
  ) {
    const itemId = randomUUID();
    const explanationJson = encodeExplanationJson({
      answerKeyJson: data.answerKeyJson,
      metadataJson: data.metadataJson,
    });

    await tx.$executeRaw`
      insert into items (
        id,
        tenant_id,
        item_type_key,
        stem_json,
        explanation_json,
        status,
        tags,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${itemId}::uuid,
        ${data.tenantId}::uuid,
        ${data.itemTypeKey},
        ${JSON.stringify(data.contentJson)}::jsonb,
        ${explanationJson ? JSON.stringify(explanationJson) : null}::jsonb,
        'DRAFT'::"PublishStatus",
        ${data.tags}::text[],
        ${data.createdByMembershipId}::uuid,
        now(),
        now()
      )
    `;

    const item = await this.findItemById(tx, itemId);
    if (!item) {
      throw new Error("ITEM_CREATE_FAILED");
    }

    return item;
  },

  async findItemById(tx: TenantTx, itemId: string) {
    return tx.item.findFirst({
      where: {
        id: itemId,
        deleted_at: null,
      },
      select: {
        id: true,
        item_type_key: true,
        stem_json: true,
        explanation_json: true,
        status: true,
        tags: true,
        created_by_membership_id: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async listItemOptions(tx: TenantTx, itemId: string) {
    return tx.itemOption.findMany({
      where: { item_id: itemId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        option_json: true,
        is_correct: true,
        position: true,
      },
    });
  },

  async updateItem(
    tx: TenantTx,
    itemId: string,
    data: {
      contentJson?: unknown;
      answerKeyJson?: unknown;
      tags?: string[];
      metadataJson?: unknown;
      status?: string;
      existingExplanationJson?: unknown;
    },
  ) {
    const currentExplanation =
      data.existingExplanationJson && typeof data.existingExplanationJson === "object"
        ? (data.existingExplanationJson as Record<string, unknown>)
        : {};

    const nextExplanation =
      data.answerKeyJson !== undefined || data.metadataJson !== undefined
        ? encodeExplanationJson({
            answerKeyJson:
              data.answerKeyJson !== undefined
                ? data.answerKeyJson
                : currentExplanation["answerKey"],
            metadataJson:
              data.metadataJson !== undefined ? data.metadataJson : currentExplanation["metadata"],
          })
        : undefined;

    return tx.item.update({
      where: { id: itemId },
      data: {
        ...(data.contentJson !== undefined ? { stem_json: data.contentJson as never } : {}),
        ...(nextExplanation !== undefined
          ? {
              explanation_json:
                nextExplanation === null ? (null as never) : (nextExplanation as never),
            }
          : {}),
        ...(data.tags !== undefined ? { tags: data.tags as never } : {}),
        ...(data.status !== undefined ? { status: data.status as never } : {}),
      },
      select: {
        id: true,
        item_type_key: true,
        stem_json: true,
        explanation_json: true,
        status: true,
        tags: true,
        created_by_membership_id: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async replaceItemOptions(
    tx: TenantTx,
    tenantId: string,
    itemId: string,
    options: Array<{
      optionJson: unknown;
      isCorrect?: boolean | null | undefined;
      position: number;
    }>,
  ) {
    await tx.itemOption.deleteMany({
      where: { item_id: itemId },
    });

    for (const option of options) {
      await tx.$executeRaw`
        insert into item_options (
          id,
          tenant_id,
          item_id,
          option_json,
          is_correct,
          position,
          created_at,
          updated_at
        )
        values (
          ${randomUUID()}::uuid,
          ${tenantId}::uuid,
          ${itemId}::uuid,
          ${JSON.stringify(option.optionJson)}::jsonb,
          ${option.isCorrect ?? null},
          ${option.position},
          now(),
          now()
        )
      `;
    }
  },

  async softDeleteItem(tx: TenantTx, itemId: string) {
    return tx.item.update({
      where: { id: itemId },
      data: {
        deleted_at: new Date(),
        status: "ARCHIVED" as never,
      },
      select: { id: true },
    });
  },

  async listDimensionWeights(tx: TenantTx, itemId: string) {
    return tx.itemDimensionWeight.findMany({
      where: { item_id: itemId },
      orderBy: { dimension_id: "asc" },
      select: {
        id: true,
        item_id: true,
        dimension_id: true,
        weight: true,
      },
    });
  },

  async replaceDimensionWeights(
    tx: TenantTx,
    tenantId: string,
    itemId: string,
    weights: Array<{ dimensionId: string; weight: number }>,
  ) {
    await tx.itemDimensionWeight.deleteMany({ where: { item_id: itemId } });

    for (const weight of weights) {
      await tx.$executeRaw`
        insert into item_dimension_weights (
          id,
          tenant_id,
          item_id,
          dimension_id,
          weight,
          created_at
        )
        values (
          ${randomUUID()}::uuid,
          ${tenantId}::uuid,
          ${itemId}::uuid,
          ${weight.dimensionId}::uuid,
          ${weight.weight},
          now()
        )
      `;
    }
  },

  async listCollections(
    tx: TenantTx,
    args: CursorArgs & {
      collectionType?: "deck" | "quiz_bank" | "practice_set" | undefined;
      status?: string | undefined;
    },
  ) {
    const rows = await tx.itemCollection.findMany({
      where: {
        deleted_at: null,
        ...(args.collectionType ? { collection_type: args.collectionType } : {}),
        ...(args.status ? { status: args.status as never } : {}),
      },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: takePlusOne(args.limit),
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        collection_type: true,
        status: true,
        metadata_json: true,
        created_at: true,
        updated_at: true,
      },
    });

    const counts = await Promise.all(
      rows.map(async (row) => {
        const count = await tx.itemCollectionItem.count({
          where: { collection_id: row.id },
        });
        return { id: row.id, count };
      }),
    );

    const countById = new Map(counts.map((entry) => [entry.id, entry.count]));

    return rows.map((row) => ({
      ...row,
      item_count: countById.get(row.id) ?? 0,
    }));
  },

  async createCollection(
    tx: TenantTx,
    data: {
      tenantId: string;
      slug: string;
      title: string;
      collectionType: "deck" | "quiz_bank" | "practice_set";
      metadataJson?: unknown;
    },
  ) {
    const collectionId = randomUUID();

    await tx.$executeRaw`
      insert into item_collections (
        id,
        tenant_id,
        slug,
        title,
        collection_type,
        status,
        metadata_json,
        created_at,
        updated_at
      )
      values (
        ${collectionId}::uuid,
        ${data.tenantId}::uuid,
        ${data.slug},
        ${data.title},
        ${data.collectionType},
        'DRAFT'::"PublishStatus",
        ${data.metadataJson ? JSON.stringify(data.metadataJson) : null}::jsonb,
        now(),
        now()
      )
    `;

    const collection = await this.findCollectionById(tx, collectionId);
    if (!collection) {
      throw new Error("COLLECTION_CREATE_FAILED");
    }

    return collection;
  },

  async findCollectionById(tx: TenantTx, collectionId: string) {
    return tx.itemCollection.findFirst({
      where: { id: collectionId, deleted_at: null },
      select: {
        id: true,
        slug: true,
        title: true,
        collection_type: true,
        status: true,
        metadata_json: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async updateCollection(
    tx: TenantTx,
    collectionId: string,
    data: {
      slug?: string;
      title?: string;
      collectionType?: "deck" | "quiz_bank" | "practice_set";
      metadataJson?: unknown;
      status?: string;
    },
  ) {
    return tx.itemCollection.update({
      where: { id: collectionId },
      data: {
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.collectionType !== undefined ? { collection_type: data.collectionType } : {}),
        ...(data.metadataJson !== undefined
          ? { metadata_json: (data.metadataJson ?? null) as never }
          : {}),
        ...(data.status !== undefined ? { status: data.status as never } : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        collection_type: true,
        status: true,
        metadata_json: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async softDeleteCollection(tx: TenantTx, collectionId: string) {
    return tx.itemCollection.update({
      where: { id: collectionId },
      data: {
        deleted_at: new Date(),
        status: "ARCHIVED" as never,
      },
      select: { id: true },
    });
  },

  async addItemToCollection(
    tx: TenantTx,
    data: {
      tenantId: string;
      collectionId: string;
      itemId: string;
      position: number;
      weight?: number | undefined;
    },
  ) {
    const rowId = randomUUID();

    await tx.$executeRaw`
      insert into item_collection_items (
        id,
        tenant_id,
        collection_id,
        item_id,
        position,
        weight,
        created_at
      )
      values (
        ${rowId}::uuid,
        ${data.tenantId}::uuid,
        ${data.collectionId}::uuid,
        ${data.itemId}::uuid,
        ${data.position},
        ${data.weight ?? null},
        now()
      )
    `;

    const row = await tx.itemCollectionItem.findFirst({
      where: { id: rowId },
      select: {
        id: true,
        collection_id: true,
        item_id: true,
        position: true,
        weight: true,
      },
    });

    if (!row) {
      throw new Error("COLLECTION_ITEM_CREATE_FAILED");
    }

    return row;
  },

  async removeItemFromCollection(tx: TenantTx, collectionId: string, itemId: string) {
    return tx.itemCollectionItem.deleteMany({
      where: {
        collection_id: collectionId,
        item_id: itemId,
      },
    });
  },
};
