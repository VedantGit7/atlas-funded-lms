import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  AddCollectionItemBodySchema,
  DeleteCollectionItemBodySchema,
} from "@atlas/api-server/item-registry/schemas";
import { itemRegistryService } from "../../../../../../server/item-registry/item-registry.service";
import {
  collectionItemListResponseSchema,
  collectionItemRemoveResponseSchema,
  collectionItemResponseSchema,
} from "@atlas/api-server/item-registry/item-registry-response-schemas";
import {
  deleteCollectionItemRouteMetadata,
  getCollectionItemsRouteMetadata,
  postCollectionItemRouteMetadata,
} from "./route.metadata";

type AddCollectionItemBody = z.output<typeof AddCollectionItemBodySchema>;
type DeleteCollectionItemBody = z.output<typeof DeleteCollectionItemBodySchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof collectionItemListResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getCollectionItemsRouteMetadata,
  params: uuidParamSchema,
  output: collectionItemListResponseSchema,
  handler: async ({ tx, params }) => {
    const collectionId = params["id"];
    if (!collectionId) throw new Error("Missing collection id");
    return itemRegistryService.listCollectionItems(tx, collectionId);
  },
});

export const POST = createTenantRoute<
  AddCollectionItemBody,
  z.output<typeof collectionItemResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postCollectionItemRouteMetadata,
  params: uuidParamSchema,
  body: AddCollectionItemBodySchema,
  output: collectionItemResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const collectionId = params["id"];
    if (!collectionId) throw new Error("Missing collection id");
    return itemRegistryService.addItemToCollection(tx, ctx, collectionId, input);
  },
});

export const DELETE = createTenantRoute<
  DeleteCollectionItemBody,
  z.output<typeof collectionItemRemoveResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteCollectionItemRouteMetadata,
  params: uuidParamSchema,
  body: DeleteCollectionItemBodySchema,
  output: collectionItemRemoveResponseSchema,
  handler: async ({ tx, params, input }) => {
    const collectionId = params["id"];
    if (!collectionId) throw new Error("Missing collection id");
    return itemRegistryService.removeItemFromCollection(tx, collectionId, input);
  },
});
