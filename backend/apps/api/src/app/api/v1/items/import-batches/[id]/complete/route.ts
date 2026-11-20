import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  ItemImportBatchParamsSchema,
  ItemImportBatchResponseSchema,
} from "@atlas/api-server/item-registry/item-import-api.contract";
import { itemImportService } from "@atlas/api-server/item-registry/item-import.service";
import { postItemImportBatchActionRouteMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marks the import finished once its last chunk is in. */
export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof ItemImportBatchResponseSchema>,
  typeof ItemImportBatchParamsSchema
>({
  metadata: postItemImportBatchActionRouteMetadata,
  params: ItemImportBatchParamsSchema,
  body: noBodySchema,
  output: ItemImportBatchResponseSchema,
  handler: async ({ tx, ctx, params }) => itemImportService.completeBatch(tx, ctx, params["id"]),
});
