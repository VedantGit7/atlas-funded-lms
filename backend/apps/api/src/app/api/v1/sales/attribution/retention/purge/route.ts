import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { purgeAttributionEventsResponseSchema } from "@atlas/domain/sales-marketing/sales-marketing.dto";
import { purgeAttributionEventsNow } from "@atlas/domain/sales-marketing/sales-marketing.service";
import { routeMetadata } from "./route.metadata";

/**
 * `POST /api/v1/sales/attribution/retention/purge` — run the purge now.
 *
 * Deletes one batch and reports whether more remain. A no-op for a tenant with
 * no retention window, which is every tenant until one opts in.
 */
export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof purgeAttributionEventsResponseSchema>
>({
  metadata: routeMetadata,
  output: purgeAttributionEventsResponseSchema,
  handler: async ({ tx, ctx }) => purgeAttributionEventsNow(tx, ctx),
});
