import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { createTag, listTenantTags } from "../../../../server/tags/tags.service";
import {
  createTagBodySchema,
  tagDetailResponseSchema,
  tagListQuerySchema,
  tagListResponseSchema,
} from "../../../../server/tags/tag-schemas";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type TagListQuery = z.output<typeof tagListQuerySchema>;
type CreateTagBody = z.output<typeof createTagBodySchema>;

export const GET = createTenantRoute<TagListQuery, z.output<typeof tagListResponseSchema>>({
  metadata: getRouteMetadata,
  input: tagListQuerySchema,
  output: tagListResponseSchema,
  handler: async ({ tx, ctx, input }) => await listTenantTags(tx, ctx, input),
});

export const POST = createTenantRoute<CreateTagBody, z.output<typeof tagDetailResponseSchema>>({
  metadata: postRouteMetadata,
  body: createTagBodySchema,
  output: tagDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => await createTag(tx, ctx, input),
});
