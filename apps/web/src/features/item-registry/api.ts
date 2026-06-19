"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import type {
  itemDetailResponseSchema,
  itemListResponseSchema,
  itemTypeListResponseSchema,
  dimensionWeightListResponseSchema,
  itemCollectionListResponseSchema,
  itemCollectionDetailResponseSchema,
  collectionItemResponseSchema,
} from "./item-registry-response-schemas";
import type {
  CreateItemBodySchema,
  UpdateItemBodySchema,
  CreateItemCollectionBodySchema,
  PutDimensionWeightsBodySchema,
  AddCollectionItemBodySchema,
} from "./schemas";

type ItemListResponse = z.infer<typeof itemListResponseSchema>;
type ItemDetailResponse = z.infer<typeof itemDetailResponseSchema>;
type ItemTypeListResponse = z.infer<typeof itemTypeListResponseSchema>;
type DimensionWeightListResponse = z.infer<typeof dimensionWeightListResponseSchema>;
type ItemCollectionListResponse = z.infer<typeof itemCollectionListResponseSchema>;
type ItemCollectionDetailResponse = z.infer<typeof itemCollectionDetailResponseSchema>;
type CollectionItemResponse = z.infer<typeof collectionItemResponseSchema>;

type CreateItemBody = z.infer<typeof CreateItemBodySchema>;
type UpdateItemBody = z.infer<typeof UpdateItemBodySchema>;
type CreateItemCollectionBody = z.infer<typeof CreateItemCollectionBodySchema>;
type PutDimensionWeightsBody = z.infer<typeof PutDimensionWeightsBodySchema>;
type AddCollectionItemBody = z.infer<typeof AddCollectionItemBodySchema>;

export type ItemDto = ItemListResponse["data"][number];
export type ItemTypeDto = ItemTypeListResponse["data"][number];
export type ItemCollectionDto = ItemCollectionListResponse["data"][number];

export async function listItemTypes(): Promise<ItemTypeListResponse> {
  return clientApi.get<ItemTypeListResponse>("/api/v1/item-types");
}

export async function listItems(query?: {
  itemTypeKey?: string;
  status?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<ItemListResponse> {
  const params = new URLSearchParams();
  if (query?.itemTypeKey) params.set("itemTypeKey", query.itemTypeKey);
  if (query?.status) params.set("status", query.status);
  if (query?.q) params.set("q", query.q);
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

export const itemRegistryApi = {
  listItemTypes,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  listDimensionWeights,
  putDimensionWeights,
  listItemCollections,
  createItemCollection,
  addItemToCollection,
  removeItemFromCollection,
  deleteItemCollection,
};

export function formatItemRegistryApiError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }

  return "Request failed.";
}
