import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  CreateItemBodySchema,
  ListItemsQuerySchema,
} from "@atlas/api-server/item-registry/schemas";
import { itemRegistryService } from "@atlas/api-server/item-registry/item-registry.service";
import {
  itemDetailResponseSchema,
  itemListResponseSchema,
} from "@atlas/api-server/item-registry/item-registry-response-schemas";
import { getItemsRouteMetadata, postItemsRouteMetadata } from "./route.metadata";

type ListItemsQuery = z.output<typeof ListItemsQuerySchema>;
type CreateItemBody = z.output<typeof CreateItemBodySchema>;

export const GET = createTenantRoute<ListItemsQuery, z.output<typeof itemListResponseSchema>>({
  metadata: getItemsRouteMetadata,
  input: ListItemsQuerySchema,
  output: itemListResponseSchema,
  handler: async ({ tx, input }) => itemRegistryService.listItems(tx, input),
});

export const POST = createTenantRoute<CreateItemBody, z.output<typeof itemDetailResponseSchema>>({
  metadata: postItemsRouteMetadata,
  body: CreateItemBodySchema,
  output: itemDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => itemRegistryService.createItem(tx, ctx, input),
});
