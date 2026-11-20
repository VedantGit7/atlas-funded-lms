import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  ImportItemRowsBodySchema,
  ImportItemRowsResponseSchema,
  ItemImportBatchParamsSchema,
} from "@atlas/api-server/item-registry/item-import-api.contract";
import { itemImportService } from "@atlas/api-server/item-registry/item-import.service";
import { postItemImportBatchActionRouteMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Imports one chunk of rows into the batch, as Draft questions. */
export const POST = createTenantRoute<
  z.output<typeof ImportItemRowsBodySchema>,
  z.output<typeof ImportItemRowsResponseSchema>,
  typeof ItemImportBatchParamsSchema
>({
  metadata: postItemImportBatchActionRouteMetadata,
  params: ItemImportBatchParamsSchema,
  body: ImportItemRowsBodySchema,
  output: ImportItemRowsResponseSchema,
  handler: async ({ tx, ctx, params, input }) =>
    itemImportService.importRows(tx, ctx, params["id"], input),
});
