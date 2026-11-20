import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { BulkDeleteItemsBodySchema } from "@atlas/api-server/item-registry/schemas";
import { bulkDeleteItemsResponseSchema } from "@atlas/api-server/item-registry/item-registry-response-schemas";
import { itemRegistryService } from "@atlas/api-server/item-registry/item-registry.service";
import { postItemBulkDeleteRouteMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deletes many of the author's items at once; items in use are kept. */
export const POST = createTenantRoute<
  z.output<typeof BulkDeleteItemsBodySchema>,
  z.output<typeof bulkDeleteItemsResponseSchema>
>({
  metadata: postItemBulkDeleteRouteMetadata,
  body: BulkDeleteItemsBodySchema,
  output: bulkDeleteItemsResponseSchema,
  handler: async ({ tx, ctx, input }) => itemRegistryService.bulkDeleteItems(tx, ctx, input),
});
