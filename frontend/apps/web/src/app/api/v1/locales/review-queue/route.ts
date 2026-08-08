import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { localeReviewQueueResponseSchema } from "../../../../../server/locales/locale.contract";
import { listLocaleReviewQueue } from "../../../../../server/locales/locale.service";
import { listLocaleReviewQueueMetadata } from "../../../../../server/locales/locale.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof localeReviewQueueResponseSchema>
>({
  metadata: listLocaleReviewQueueMetadata,
  output: localeReviewQueueResponseSchema,
  handler: async ({ tx, ctx }) => listLocaleReviewQueue(tx, ctx),
});
