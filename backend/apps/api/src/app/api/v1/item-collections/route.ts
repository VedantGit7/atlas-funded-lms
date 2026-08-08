import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  CreateItemCollectionBodySchema,
  ListItemCollectionsQuerySchema,
} from "@atlas/api-server/item-registry/schemas";
import { itemRegistryService } from "@atlas/api-server/item-registry/item-registry.service";
import {
  itemCollectionDetailResponseSchema,
  itemCollectionListResponseSchema,
} from "@atlas/api-server/item-registry/item-registry-response-schemas";
import {
  getItemCollectionsRouteMetadata,
  postItemCollectionsRouteMetadata,
} from "./route.metadata";

type ListItemCollectionsQuery = z.output<typeof ListItemCollectionsQuerySchema>;
type CreateItemCollectionBody = z.output<typeof CreateItemCollectionBodySchema>;

export const GET = createTenantRoute<
  ListItemCollectionsQuery,
  z.output<typeof itemCollectionListResponseSchema>
>({
  metadata: getItemCollectionsRouteMetadata,
  input: ListItemCollectionsQuerySchema,
  output: itemCollectionListResponseSchema,
  handler: async ({ tx, input }) => itemRegistryService.listCollections(tx, input),
});

export const POST = createTenantRoute<
  CreateItemCollectionBody,
  z.output<typeof itemCollectionDetailResponseSchema>
>({
  metadata: postItemCollectionsRouteMetadata,
  body: CreateItemCollectionBodySchema,
  output: itemCollectionDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => itemRegistryService.createCollection(tx, ctx, input),
});
