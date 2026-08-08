import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { getMemberCompetency } from "../../../../../../server/competency/competency-query.service";
import { memberCompetencyResponseSchema } from "../../../../../../server/competency/competency-projection.schemas";
import { getRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: getRouteMetadata,
  params: uuidParamSchema,
  output: memberCompetencyResponseSchema,
  handler: async ({ tx, params }) => {
    const { id } = uuidParamSchema.parse(params);
    return getMemberCompetency(tx, id);
  },
});
