import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { AddCollectionItemsBodySchema } from "@atlas/api-server/item-registry/schemas";
import { collectionItemsAddResponseSchema } from "@atlas/api-server/item-registry/item-registry-response-schemas";
import { itemRegistryService } from "../../../../../../../server/item-registry/item-registry.service";
import { routeMetadata } from "./route.metadata";

type AddCollectionItemsBody = z.output<typeof AddCollectionItemsBodySchema>;

/** Adds many questions to a collection at once, at the end (QA review 1 C8). */
export const POST = createTenantRoute<
  AddCollectionItemsBody,
  z.output<typeof collectionItemsAddResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: routeMetadata,
  params: uuidParamSchema,
  body: AddCollectionItemsBodySchema,
  output: collectionItemsAddResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const collectionId = params["id"];
    if (!collectionId) throw new Error("Missing collection id");
    return itemRegistryService.addItemsToCollection(tx, ctx, collectionId, input);
  },
});
