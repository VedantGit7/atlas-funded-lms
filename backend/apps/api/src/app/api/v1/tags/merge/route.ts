import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { mergeTags } from "../../../../../server/tags/tags.service";
import {
  mergeTagsBodySchema,
  mergeTagsResponseSchema,
} from "../../../../../server/tags/tag-schemas";
import { postRouteMetadata } from "./route.metadata";

type MergeTagsBody = z.output<typeof mergeTagsBodySchema>;

/** `POST /api/v1/tags/merge` — fold one tag into another, keeping attachments. */
export const POST = createTenantRoute<MergeTagsBody, z.output<typeof mergeTagsResponseSchema>>({
  metadata: postRouteMetadata,
  body: mergeTagsBodySchema,
  output: mergeTagsResponseSchema,
  handler: async ({ tx, ctx, input }) => await mergeTags(tx, ctx, input),
});
