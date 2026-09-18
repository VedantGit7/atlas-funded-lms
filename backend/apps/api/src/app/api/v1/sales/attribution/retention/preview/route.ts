import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionRetentionPreviewQuerySchema,
  attributionRetentionPreviewResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { previewAttributionRetention } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `GET /api/v1/sales/attribution/retention/preview` — what a window would cost.
 *
 * Read-only: an operator must be able to ask "what would 90 days delete" and
 * get a number without having committed to anything.
 */
export const GET = createTenantRoute<
  z.output<typeof attributionRetentionPreviewQuerySchema>,
  z.output<typeof attributionRetentionPreviewResponseSchema>
>({
  metadata: routeMetadata,
  input: attributionRetentionPreviewQuerySchema,
  output: attributionRetentionPreviewResponseSchema,
  handler: async ({ tx, ctx, input }) => previewAttributionRetention(tx, ctx, input),
});
