import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attributionRetentionBodySchema,
  attributionRetentionResponseSchema,
} from "@atlas/domain/sales-marketing/sales-marketing.dto";
import {
  getAttributionRetention,
  setAttributionRetention,
} from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata, setAttributionRetentionMetadata } from "./route.metadata";

/** `GET /api/v1/sales/attribution/retention` — the policy and its impact. */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof attributionRetentionResponseSchema>
>({
  metadata: routeMetadata,
  output: attributionRetentionResponseSchema,
  handler: async ({ tx, ctx }) => getAttributionRetention(tx, ctx),
});

/**
 * `PUT` — set the window.
 *
 * Saving deletes nothing; the sweep and the manual purge do that. Separating
 * them means a mistyped window can be corrected before any row is gone.
 */
export const PUT = createTenantRoute<
  z.output<typeof attributionRetentionBodySchema>,
  z.output<typeof attributionRetentionResponseSchema>
>({
  metadata: setAttributionRetentionMetadata,
  body: attributionRetentionBodySchema,
  output: attributionRetentionResponseSchema,
  handler: async ({ tx, ctx, input }) => setAttributionRetention(tx, ctx, input),
});
