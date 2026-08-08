import { createTenantRoute } from "@atlas/api";
import { itemRegistryService } from "@atlas/api-server/item-registry/item-registry.service";
import { itemTypeListResponseSchema } from "@atlas/api-server/item-registry/item-registry-response-schemas";
import { getItemTypesRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: getItemTypesRouteMetadata,
  output: itemTypeListResponseSchema,
  handler: async ({ tx }) => itemRegistryService.listItemTypes(tx),
});
