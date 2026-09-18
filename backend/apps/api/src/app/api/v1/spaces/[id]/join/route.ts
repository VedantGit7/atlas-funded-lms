import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  joinSpaceResponseSchema,
  spaceIdParamsSchema,
} from "../../../../../../server/community/community.dto";
import { joinSpace } from "../../../../../../server/community/community.service";
import { joinSpaceMetadata } from "../../../../../../server/community/community.route-metadata";

export const POST = createTenantRoute<
  Record<string, never>,
  z.output<typeof joinSpaceResponseSchema>,
  typeof spaceIdParamsSchema
>({
  metadata: joinSpaceMetadata,
  params: spaceIdParamsSchema,
  output: joinSpaceResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    return joinSpace(tx, ctx, params.id);
  },
});
