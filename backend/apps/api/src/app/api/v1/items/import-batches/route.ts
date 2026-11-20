import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  CreateItemImportBatchBodySchema,
  ItemImportBatchListQuerySchema,
  ItemImportBatchListResponseSchema,
  ItemImportBatchResponseSchema,
} from "@atlas/api-server/item-registry/item-import-api.contract";
import { itemImportService } from "@atlas/api-server/item-registry/item-import.service";
import {
  getItemImportBatchesRouteMetadata,
  postItemImportBatchRouteMetadata,
} from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The academy's imports, newest first, with what is left of each. */
export const GET = createTenantRoute<
  z.output<typeof ItemImportBatchListQuerySchema>,
  z.output<typeof ItemImportBatchListResponseSchema>
>({
  metadata: getItemImportBatchesRouteMetadata,
  input: ItemImportBatchListQuerySchema,
  output: ItemImportBatchListResponseSchema,
  handler: async ({ tx, ctx, input }) => itemImportService.listBatches(tx, ctx, input),
});

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
