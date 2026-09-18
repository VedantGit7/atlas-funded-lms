import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import { z as zod } from "zod";
import { saveNewsfeedPostResponseSchema } from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.schemas";
import { mutateMeNewsfeedSaveMetadata } from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.me-route-metadata";
import {
  savePublicNewsfeedPost,
  unsavePublicNewsfeedPost,
} from "../../../../../../../server/marketing-newsfeed/marketing-newsfeed.service";

const paramsSchema = zod.object({ id: zod.uuid() });

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof saveNewsfeedPostResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMeNewsfeedSaveMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: saveNewsfeedPostResponseSchema,
  handler: async ({ tx, ctx, params }) => savePublicNewsfeedPost(tx, ctx, params["id"]),
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  z.output<typeof saveNewsfeedPostResponseSchema>,
  typeof paramsSchema
>({
  metadata: mutateMeNewsfeedSaveMetadata,
  params: paramsSchema,
  body: noBodySchema,
  output: saveNewsfeedPostResponseSchema,
  handler: async ({ tx, ctx, params }) => unsavePublicNewsfeedPost(tx, ctx, params["id"]),
});
