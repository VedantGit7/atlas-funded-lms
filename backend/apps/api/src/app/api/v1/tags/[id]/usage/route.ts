import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { getTagUsage } from "../../../../../../server/tags/tags.service";
import { tagUsageResponseSchema } from "../../../../../../server/tags/tag-schemas";
import { getRouteMetadata } from "./route.metadata";

/** `GET /api/v1/tags/[id]/usage` — the courses and lessons carrying this tag. */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof tagUsageResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: tagUsageResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const tagId = params["id"];
    if (!tagId) throw new Error("Missing tag id");
    return await getTagUsage(tx, ctx, tagId);
  },
});
