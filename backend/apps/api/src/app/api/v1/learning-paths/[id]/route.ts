import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  deleteLearningPath,
  getLearningPathById,
  updateLearningPath,
} from "../../../../../server/learning-paths/learning-path.service";
import {
  deleteLearningPathResponseSchema,
  learningPathDetailResponseSchema,
  learningPathIdParamsSchema,
  pathDetailQuerySchema,
  updateLearningPathBodySchema,
} from "../../../../../server/learning-paths/learning-path.schemas";
import { deleteRouteMetadata, getRouteMetadata, putRouteMetadata } from "./route.metadata";

type PathDetailQuery = z.output<typeof pathDetailQuerySchema>;
type LearningPathDetailResponse = z.output<typeof learningPathDetailResponseSchema>;
type UpdateLearningPathBody = z.output<typeof updateLearningPathBodySchema>;
type DeleteLearningPathResponse = z.output<typeof deleteLearningPathResponseSchema>;

export const GET = createTenantRoute<
  PathDetailQuery,
  LearningPathDetailResponse,
  typeof learningPathIdParamsSchema
>({
  metadata: getRouteMetadata,
  params: learningPathIdParamsSchema,
  input: pathDetailQuerySchema,
  output: learningPathDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");
    return await getLearningPathById(tx, ctx, pathId, input);
  },
});

export const PUT = createTenantRoute<
  UpdateLearningPathBody,
  LearningPathDetailResponse,
  typeof learningPathIdParamsSchema
>({
  metadata: putRouteMetadata,
  params: learningPathIdParamsSchema,
  body: updateLearningPathBodySchema,
  output: learningPathDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");
    return await updateLearningPath(tx, ctx, pathId, input);
  },
});

export const DELETE = createTenantRoute<
  Record<string, never>,
  DeleteLearningPathResponse,
  typeof learningPathIdParamsSchema
>({
  metadata: deleteRouteMetadata,
  params: learningPathIdParamsSchema,
  output: deleteLearningPathResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");
    return await deleteLearningPath(tx, ctx, pathId);
  },
});
