import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  ItemImportCheckBodySchema,
  ItemImportCheckResponseSchema,
} from "@atlas/api-server/item-registry/item-import-api.contract";
import { itemImportService } from "@atlas/api-server/item-registry/item-import.service";
import { postItemImportCheckRouteMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rows of a filled-in template, checked and compared with the bank. */
export const POST = createTenantRoute<
  z.output<typeof ItemImportCheckBodySchema>,
  z.output<typeof ItemImportCheckResponseSchema>
>({
  metadata: postItemImportCheckRouteMetadata,
  body: ItemImportCheckBodySchema,
  output: ItemImportCheckResponseSchema,
  handler: async ({ tx, ctx, input }) => itemImportService.checkRows(tx, ctx, input),
});
