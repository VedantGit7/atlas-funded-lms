import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { BulkItemStatusBodySchema } from "@atlas/api-server/item-registry/schemas";
import { bulkItemStatusResponseSchema } from "@atlas/api-server/item-registry/item-registry-response-schemas";
import { itemRegistryService } from "@atlas/api-server/item-registry/item-registry.service";
import { postItemBulkStatusRouteMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publishes, unpublishes or archives many of the author's items at once. */
export const POST = createTenantRoute<
  z.output<typeof BulkItemStatusBodySchema>,
  z.output<typeof bulkItemStatusResponseSchema>
>({
  metadata: postItemBulkStatusRouteMetadata,
  body: BulkItemStatusBodySchema,
  output: bulkItemStatusResponseSchema,
  handler: async ({ tx, ctx, input }) => itemRegistryService.bulkSetItemStatus(tx, ctx, input),
});
