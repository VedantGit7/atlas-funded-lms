import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { bulkTagAction } from "../../../../../server/tags/tags.service";
import {
  bulkTagActionBodySchema,
  bulkTagActionResponseSchema,
} from "../../../../../server/tags/tag-schemas";
import { postRouteMetadata } from "./route.metadata";

type BulkTagActionBody = z.output<typeof bulkTagActionBodySchema>;

/** `POST /api/v1/tags/bulk` — re-scope or delete a selection of tags at once. */
export const POST = createTenantRoute<
  BulkTagActionBody,
  z.output<typeof bulkTagActionResponseSchema>
>({
  metadata: postRouteMetadata,
  body: bulkTagActionBodySchema,
  output: bulkTagActionResponseSchema,
  handler: async ({ tx, ctx, input }) => await bulkTagAction(tx, ctx, input),
});
