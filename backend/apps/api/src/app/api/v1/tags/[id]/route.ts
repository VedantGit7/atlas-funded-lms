import { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { deleteTag, getTag, updateTag } from "../../../../../server/tags/tags.service";
import {
  tagDetailResponseSchema,
  updateTagBodySchema,
} from "../../../../../server/tags/tag-schemas";
import { deleteRouteMetadata, getRouteMetadata, putRouteMetadata } from "./route.metadata";

type UpdateTagBody = z.output<typeof updateTagBodySchema>;

const deleteTagResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    deleted: z.literal(true),
  }),
});

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof tagDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: tagDetailResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const tagId = params["id"];
    if (!tagId) throw new Error("Missing tag id");
    return await getTag(tx, ctx, tagId);
  },
});

export const PUT = createTenantRoute<
  UpdateTagBody,
  z.output<typeof tagDetailResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: putRouteMetadata,
  params: uuidParamSchema,
  body: updateTagBodySchema,
  output: tagDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const tagId = params["id"];
    if (!tagId) throw new Error("Missing tag id");
    return await updateTag(tx, ctx, tagId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof deleteTagResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: deleteRouteMetadata,
  params: uuidParamSchema,
  output: deleteTagResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const tagId = params["id"];
    if (!tagId) throw new Error("Missing tag id");
    return await deleteTag(tx, ctx, tagId);
  },
});
