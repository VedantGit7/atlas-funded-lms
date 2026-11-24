import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { getMemberOverview } from "../../../../../../server/members/member-overview.service";
import { memberOverviewResponseSchema } from "../../../../../../server/members/member-overview.schemas";
import { getRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: memberOverviewResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return getMemberOverview(tx, ctx, id);
  },
});
