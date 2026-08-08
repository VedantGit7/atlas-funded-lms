import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteCompetencyDimension,
  updateCompetencyDimension,
} from "../../../../../server/competency/competency-config.service";
import {
  competencyDimensionDetailResponseSchema,
  competencyDimensionIdParamsSchema,
  deleteDimensionResponseSchema,
  updateDimensionBodySchema,
} from "../../../../../server/competency/competency-config.schemas";
import { deleteRouteMetadata, putRouteMetadata } from "./route.metadata";

type UpdateDimensionBody = z.output<typeof updateDimensionBodySchema>;
type CompetencyDimensionDetailResponse = z.output<typeof competencyDimensionDetailResponseSchema>;
type DeleteDimensionResponse = z.output<typeof deleteDimensionResponseSchema>;

export const PUT = createTenantRoute<
  UpdateDimensionBody,
  CompetencyDimensionDetailResponse,
  typeof competencyDimensionIdParamsSchema
>({
  metadata: putRouteMetadata,
  params: competencyDimensionIdParamsSchema,
  body: updateDimensionBodySchema,
  output: competencyDimensionDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const dimensionId = params["id"];
    if (!dimensionId) throw new Error("Missing competency dimension id");
    return await updateCompetencyDimension(tx, ctx, dimensionId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  DeleteDimensionResponse,
  typeof competencyDimensionIdParamsSchema
>({
  metadata: deleteRouteMetadata,
  params: competencyDimensionIdParamsSchema,
  output: deleteDimensionResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const dimensionId = params["id"];
    if (!dimensionId) throw new Error("Missing competency dimension id");
    return await deleteCompetencyDimension(tx, ctx, dimensionId);
  },
});
