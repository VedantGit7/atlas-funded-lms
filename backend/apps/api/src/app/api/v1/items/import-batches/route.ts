import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  CreateItemImportBatchBodySchema,
  ItemImportBatchResponseSchema,
} from "@atlas/api-server/item-registry/item-import-api.contract";
import { itemImportService } from "@atlas/api-server/item-registry/item-import.service";
import { postItemImportBatchRouteMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Opens an import for the rows of a checked file. */
export const POST = createTenantRoute<
  z.output<typeof CreateItemImportBatchBodySchema>,
  z.output<typeof ItemImportBatchResponseSchema>
>({
  metadata: postItemImportBatchRouteMetadata,
  body: CreateItemImportBatchBodySchema,
  output: ItemImportBatchResponseSchema,
  handler: async ({ tx, ctx, input }) => itemImportService.createBatch(tx, ctx, input),
});
