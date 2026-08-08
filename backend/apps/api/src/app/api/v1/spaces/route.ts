import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createSpaceBodySchema,
  deleteSpaceBodySchema,
  spaceListResponseSchema,
  spaceDetailResponseSchema,
  updateSpaceBodySchema,
  deleteSpaceResponseSchema,
} from "../../../../server/community/community.dto";
import {
  createSpace,
  deleteSpace,
  listSpaces,
  updateSpace,
} from "../../../../server/community/community.service";
import {
  deleteSpaceMetadata,
  listSpacesMetadata,
  manageSpacesMetadata,
  updateSpaceMetadata,
} from "../../../../server/community/community.route-metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof spaceListResponseSchema>
>({
  metadata: listSpacesMetadata,
  output: spaceListResponseSchema,
  handler: async ({ tx, ctx }) => listSpaces(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createSpaceBodySchema>,
  z.output<typeof spaceDetailResponseSchema>
>({
  metadata: manageSpacesMetadata,
  body: createSpaceBodySchema,
  output: spaceDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => createSpace(tx, ctx, input),
});

export const PUT = createTenantRoute<
  z.output<typeof updateSpaceBodySchema>,
  z.output<typeof spaceDetailResponseSchema>
>({
  metadata: updateSpaceMetadata,
  body: updateSpaceBodySchema,
  output: spaceDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => updateSpace(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  z.output<typeof deleteSpaceBodySchema>,
  z.output<typeof deleteSpaceResponseSchema>
>({
  metadata: deleteSpaceMetadata,
  body: deleteSpaceBodySchema,
  output: deleteSpaceResponseSchema,
  handler: async ({ tx, ctx, input }) => deleteSpace(tx, ctx, input),
});
