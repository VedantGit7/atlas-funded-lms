import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getMyCompetencyHistory } from "../../../../../../server/competency/competency-query.service";
import {
  competencyHistoryQuerySchema,
  competencyHistoryResponseSchema,
} from "../../../../../../server/competency/competency-projection.schemas";
import { getRouteMetadata } from "./route.metadata";

type CompetencyHistoryQuery = z.output<typeof competencyHistoryQuerySchema>;
type CompetencyHistoryResponse = z.output<typeof competencyHistoryResponseSchema>;

export const GET = createTenantRoute<CompetencyHistoryQuery, CompetencyHistoryResponse>({
  metadata: getRouteMetadata,
  input: competencyHistoryQuerySchema,
  output: competencyHistoryResponseSchema,
  handler: async ({ tx, ctx, input }) => getMyCompetencyHistory(tx, ctx, input),
});
