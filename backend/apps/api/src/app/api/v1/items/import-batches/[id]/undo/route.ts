import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  ItemImportBatchParamsSchema,
  UndoItemImportBatchResponseSchema,
} from "@atlas/api-server/item-registry/item-import-api.contract";
import { itemImportService } from "@atlas/api-server/item-registry/item-import.service";
import { postItemImportBatchUndoRouteMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Takes an import's unused questions back out of the bank. */
export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof UndoItemImportBatchResponseSchema>,
  typeof ItemImportBatchParamsSchema
>({
  metadata: postItemImportBatchUndoRouteMetadata,
  params: ItemImportBatchParamsSchema,
  body: noBodySchema,
  output: UndoItemImportBatchResponseSchema,
  handler: async ({ tx, ctx, params }) => itemImportService.undoBatch(tx, ctx, params["id"]),
});
