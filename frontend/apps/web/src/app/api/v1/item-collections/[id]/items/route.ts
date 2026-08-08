import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  AddCollectionItemBodySchema,
  DeleteCollectionItemBodySchema,
} from "../../../../../../features/item-registry/schemas";
import { itemRegistryService } from "../../../../../../server/item-registry/item-registry.service";
import {
  collectionItemRemoveResponseSchema,
  collectionItemResponseSchema,
} from "../../../../../../features/item-registry/item-registry-response-schemas";
import {
  deleteCollectionItemRouteMetadata,
  postCollectionItemRouteMetadata,
} from "./route.metadata";

type AddCollectionItemBody = z.output<typeof AddCollectionItemBodySchema>;
type DeleteCollectionItemBody = z.output<typeof DeleteCollectionItemBodySchema>;

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
