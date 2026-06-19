import { createTenantRoute } from "@atlas/api";
import { getMyCompetency } from "../../../../../server/competency/competency-query.service";
import { myCompetencyResponseSchema } from "../../../../../server/competency/competency-projection.schemas";
import { getRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute({
  metadata: getRouteMetadata,
  output: myCompetencyResponseSchema,
  handler: async ({ tx, ctx }) => getMyCompetency(tx, ctx),
});
