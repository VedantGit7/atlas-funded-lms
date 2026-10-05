import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { UpdateItemCollectionBodySchema } from "@atlas/api-server/item-registry/schemas";
import { itemRegistryService } from "../../../../../server/item-registry/item-registry.service";
import {
  itemCollectionDeleteResponseSchema,
  itemCollectionDetailResponseSchema,
} from "@atlas/api-server/item-registry/item-registry-response-schemas";
import {
  deleteItemCollectionRouteMetadata,
  putItemCollectionRouteMetadata,
} from "./route.metadata";

type UpdateItemCollectionBody = z.output<typeof UpdateItemCollectionBodySchema>;

export const PUT = createTenantRoute<
  UpdateItemCollectionBody,
  z.output<typeof itemCollectionDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putItemCollectionRouteMetadata,
  params: uuidParamSchema,
  body: UpdateItemCollectionBodySchema,
  output: itemCollectionDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const collectionId = params["id"];
    if (!collectionId) throw new Error("Missing collection id");
    return itemRegistryService.updateCollection(tx, ctx, collectionId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof itemCollectionDeleteResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteItemCollectionRouteMetadata,
  params: uuidParamSchema,
  output: itemCollectionDeleteResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const collectionId = params["id"];
    if (!collectionId) throw new Error("Missing collection id");
    return itemRegistryService.deleteCollection(tx, ctx, collectionId);
  },
});
