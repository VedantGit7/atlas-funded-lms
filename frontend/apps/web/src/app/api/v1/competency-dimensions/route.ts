import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createCompetencyDimension,
  listCompetencyDimensions,
} from "../../../../server/competency/competency-config.service";
import {
  competencyDimensionDetailResponseSchema,
  competencyDimensionListResponseSchema,
  createDimensionBodySchema,
} from "../../../../server/competency/competency-config.schemas";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type CreateDimensionBody = z.output<typeof createDimensionBodySchema>;
type CompetencyDimensionListResponse = z.output<typeof competencyDimensionListResponseSchema>;
type CompetencyDimensionDetailResponse = z.output<typeof competencyDimensionDetailResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, CompetencyDimensionListResponse>({
  metadata: getRouteMetadata,
  output: competencyDimensionListResponseSchema,
  handler: async ({ tx }) => await listCompetencyDimensions(tx),
});

export const POST = createTenantRoute<CreateDimensionBody, CompetencyDimensionDetailResponse>({
  metadata: postRouteMetadata,
  body: createDimensionBodySchema,
  output: competencyDimensionDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => await createCompetencyDimension(tx, ctx, input),
});
