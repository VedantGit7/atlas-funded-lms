import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listTenantCompetencySignals } from "../../../../server/competency/competency-query.service";
import {
  competencySignalsListResponseSchema,
  competencySignalsQuerySchema,
} from "../../../../server/competency/competency-projection.schemas";
import { getRouteMetadata } from "./route.metadata";

type CompetencySignalsQuery = z.output<typeof competencySignalsQuerySchema>;
type CompetencySignalsListResponse = z.output<typeof competencySignalsListResponseSchema>;

export const GET = createTenantRoute<CompetencySignalsQuery, CompetencySignalsListResponse>({
  metadata: getRouteMetadata,
  input: competencySignalsQuerySchema,
  output: competencySignalsListResponseSchema,
  handler: async ({ tx, input }) => await listTenantCompetencySignals(tx, input),
});
