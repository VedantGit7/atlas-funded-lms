"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import type {
  bulkItemStatusResponseSchema,
  itemDetailResponseSchema,
  itemListResponseSchema,
  itemTypeListResponseSchema,
  dimensionWeightListResponseSchema,
  itemCollectionListResponseSchema,
  itemCollectionDetailResponseSchema,
  collectionItemResponseSchema,
  collectionItemListResponseSchema,
} from "./item-registry-response-schemas";
import type {
  ImportItemRowsResponse,
  ItemImportBatch,
  ItemImportCheckResponse,
  ItemImportHistoryEntry,
  ItemImportBatchListQuery,
} from "@atlas/contracts/item-registry/item-import-api.contract";
import type { ImportApi } from "./import/run-import";
import type {
  BulkItemStatusBodySchema,
  CreateItemBodySchema,
  UpdateItemBodySchema,
  CreateItemCollectionBodySchema,
  PutDimensionWeightsBodySchema,
  UpdateItemCollectionBodySchema,
  AddCollectionItemBodySchema,
} from "./schemas";

type ItemListResponse = z.infer<typeof itemListResponseSchema>;
type ItemDetailResponse = z.infer<typeof itemDetailResponseSchema>;
export type BulkItemStatusResponse = z.infer<typeof bulkItemStatusResponseSchema>;
export type BulkItemStatusBody = z.infer<typeof BulkItemStatusBodySchema>;
export type ItemListPage = ItemListResponse;
type ItemTypeListResponse = z.infer<typeof itemTypeListResponseSchema>;
type DimensionWeightListResponse = z.infer<typeof dimensionWeightListResponseSchema>;
type ItemCollectionListResponse = z.infer<typeof itemCollectionListResponseSchema>;
type ItemCollectionDetailResponse = z.infer<typeof itemCollectionDetailResponseSchema>;
type CollectionItemResponse = z.infer<typeof collectionItemResponseSchema>;
type CollectionItemListResponse = z.infer<typeof collectionItemListResponseSchema>;

type CreateItemBody = z.infer<typeof CreateItemBodySchema>;
type UpdateItemBody = z.infer<typeof UpdateItemBodySchema>;
type CreateItemCollectionBody = z.infer<typeof CreateItemCollectionBodySchema>;
type UpdateItemCollectionBody = z.infer<typeof UpdateItemCollectionBodySchema>;
type PutDimensionWeightsBody = z.infer<typeof PutDimensionWeightsBodySchema>;
type AddCollectionItemBody = z.infer<typeof AddCollectionItemBodySchema>;

export type ItemDto = ItemListResponse["data"][number];
export type ItemTypeDto = ItemTypeListResponse["data"][number];
export type ItemCollectionDto = ItemCollectionListResponse["data"][number];

export async function listItemTypes(): Promise<ItemTypeListResponse> {
  return clientApi.get<ItemTypeListResponse>("/api/v1/item-types");
}

export type ItemListQuery = {
  itemTypeKey?: string;
  status?: string;
  q?: string;
  importBatchId?: string;
  limit?: number;
  cursor?: string;
};

export async function listItems(query?: ItemListQuery): Promise<ItemListResponse> {
  const params = new URLSearchParams();
  if (query?.itemTypeKey) params.set("itemTypeKey", query.itemTypeKey);
  if (query?.status) params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
  if (query?.importBatchId) params.set("importBatchId", query.importBatchId);
  if (query?.limit != null) params.set("limit", String(query.limit));
  if (query?.cursor) params.set("cursor", query.cursor);

  const suffix = params.toString();
  return clientApi.get<ItemListResponse>(`/api/v1/items${suffix ? `?${suffix}` : ""}`);
}

export async function createItem(body: CreateItemBody): Promise<ItemDetailResponse> {
  return clientApi.post<ItemDetailResponse>("/api/v1/items", body, "create-item");
}

export async function updateItem(
  itemId: string,
  body: UpdateItemBody,
): Promise<ItemDetailResponse> {
  return clientApi.put<ItemDetailResponse>(`/api/v1/items/${itemId}`, body, "update-item");
}

/**
 * Publishes, unpublishes or archives many items. A filter request changes at
 * most BULK_ITEM_STATUS_MAX items; repeat it while data.remaining > 0, each
 * time with a new idempotency key.
 */
export async function bulkSetItemStatus(
  body: BulkItemStatusBody,
  idempotencyKey: string,
): Promise<BulkItemStatusResponse> {
  return clientApi.postWithKey<BulkItemStatusResponse>(
    "/api/v1/items/bulk-status",
    body,
    idempotencyKey,
    { silent: true },
  );
}

export async function deleteItem(itemId: string): Promise<{ data: { id: string; deleted: true } }> {
  return clientApi.delete(`/api/v1/items/${itemId}`, "delete-item");
}

export async function listDimensionWeights(itemId: string): Promise<DimensionWeightListResponse> {
  return clientApi.get<DimensionWeightListResponse>(`/api/v1/items/${itemId}/dimension-weights`);
}

export async function putDimensionWeights(
  itemId: string,
  body: PutDimensionWeightsBody,
): Promise<DimensionWeightListResponse> {
  return clientApi.put<DimensionWeightListResponse>(
    `/api/v1/items/${itemId}/dimension-weights`,
    body,
    "put-dimension-weights",
  );
}

export async function listItemCollections(query?: {
  collectionType?: string;
  status?: string;
  limit?: number;
}): Promise<ItemCollectionListResponse> {
  const params = new URLSearchParams();
  if (query?.collectionType) params.set("collectionType", query.collectionType);
  if (query?.status) params.set("status", query.status);
  if (query?.limit != null) params.set("limit", String(query.limit));

  const suffix = params.toString();
  return clientApi.get<ItemCollectionListResponse>(
    `/api/v1/item-collections${suffix ? `?${suffix}` : ""}`,
  );
}

export async function createItemCollection(
  body: CreateItemCollectionBody,
): Promise<ItemCollectionDetailResponse> {
  return clientApi.post<ItemCollectionDetailResponse>(
    "/api/v1/item-collections",
    body,
    "create-item-collection",
  );
}

export async function updateItemCollection(
  collectionId: string,
  body: UpdateItemCollectionBody,
): Promise<ItemCollectionDetailResponse> {
  return clientApi.put<ItemCollectionDetailResponse>(
    `/api/v1/item-collections/${collectionId}`,
    body,
    `update-item-collection-${collectionId}`,
  );
}

export async function addItemToCollection(
  collectionId: string,
  body: AddCollectionItemBody,
): Promise<CollectionItemResponse> {
  return clientApi.post<CollectionItemResponse>(
    `/api/v1/item-collections/${collectionId}/items`,
    body,
    "add-collection-item",
  );
}

export async function listCollectionItems(
  collectionId: string,
): Promise<CollectionItemListResponse> {
  return clientApi.get<CollectionItemListResponse>(
    `/api/v1/item-collections/${collectionId}/items`,
  );
}

export async function removeItemFromCollection(
  collectionId: string,
  itemId: string,
): Promise<{ data: { collectionId: string; itemId: string; removed: true } }> {
  return clientApi.delete(
    `/api/v1/item-collections/${collectionId}/items`,
    "remove-collection-item",
    { itemId },
  );
}

export async function deleteItemCollection(
  collectionId: string,
): Promise<{ data: { id: string; deleted: true } }> {
  return clientApi.delete(`/api/v1/item-collections/${collectionId}`, "delete-item-collection");
}

type ItemImportTemplateResponse = {
  data: {
    filename: string;
    contentType: string;
    content: string;
    contentEncoding: "base64";
    templateVersion: string;
  };
};

/** Fetches the Excel import template for one question type and saves it. */
export async function downloadItemImportTemplate(itemTypeKey: string): Promise<void> {
  const response = await clientApi.get<ItemImportTemplateResponse>(
    `/api/v1/items/import-templates/${encodeURIComponent(itemTypeKey)}`,
  );
  const binary = atob(response.data.content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: response.data.contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = response.data.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The requests behind importing a filled-in template (item-import-api.contract.ts). */
export const itemImportApi: ImportApi = {
  check: (body) =>
    clientApi.post<ItemImportCheckResponse>(
      "/api/v1/items/import-check",
      body,
      "item-import-check",
      {
        silent: true,
      },
    ),
  createBatch: (body, idempotencyKey) =>
    clientApi.postWithKey<{ data: ItemImportBatch }>(
      "/api/v1/items/import-batches",
      body,
      idempotencyKey,
      {
        silent: true,
      },
    ),
  importRows: (batchId, body, idempotencyKey) =>
    clientApi.postWithKey<ImportItemRowsResponse>(
      `/api/v1/items/import-batches/${encodeURIComponent(batchId)}/rows`,
      body,
      idempotencyKey,
      { silent: true },
    ),
  complete: (batchId, idempotencyKey) =>
    clientApi.postWithKey<{ data: ItemImportBatch }>(
      `/api/v1/items/import-batches/${encodeURIComponent(batchId)}/complete`,
      null,
      idempotencyKey,
      { silent: true },
    ),
};

/** The academy's question imports, newest first. */
export async function listImportBatches(query: Partial<ItemImportBatchListQuery> = {}): Promise<{
  data: ItemImportHistoryEntry[];
  page: { nextCursor: string | null; hasMore: boolean };
}> {
  const params = new URLSearchParams();
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  const suffix = params.toString();
  return clientApi.get(`/api/v1/items/import-batches${suffix ? `?${suffix}` : ""}`);
}

/** Takes an import's unused questions back out of the bank. */
export async function undoImportBatch(
  batchId: string,
  idempotencyKey: string,
): Promise<{ data: { batch: ItemImportBatch; removed: number; kept: number } }> {
  return clientApi.postWithKey(
    `/api/v1/items/import-batches/${encodeURIComponent(batchId)}/undo`,
    null,
    idempotencyKey,
    { silent: true },
  );
}

export const itemRegistryApi = {
  downloadItemImportTemplate,
  listItemTypes,
  listItems,
  bulkSetItemStatus,
  listImportBatches,
  undoImportBatch,
  createItem,
  updateItem,
  deleteItem,
  listDimensionWeights,
  putDimensionWeights,
  listItemCollections,
  createItemCollection,
  updateItemCollection,
  addItemToCollection,
  listCollectionItems,
  removeItemFromCollection,
  deleteItemCollection,
};

export function formatItemRegistryApiError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }

  return "Request failed.";
}
