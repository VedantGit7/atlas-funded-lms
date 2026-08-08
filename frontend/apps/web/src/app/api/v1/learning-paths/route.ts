import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createLearningPathDraft,
  listLearningPaths,
} from "../../../../server/learning-paths/learning-path.service";
import {
  createLearningPathBodySchema,
  createLearningPathResponseSchema,
  learningPathListQuerySchema,
  learningPathListResponseSchema,
} from "../../../../server/learning-paths/learning-path.schemas";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type LearningPathListQuery = z.output<typeof learningPathListQuerySchema>;
type LearningPathListResponse = z.output<typeof learningPathListResponseSchema>;
type CreateLearningPathBody = z.output<typeof createLearningPathBodySchema>;
type CreateLearningPathResponse = z.output<typeof createLearningPathResponseSchema>;

export const GET = createTenantRoute<LearningPathListQuery, LearningPathListResponse>({
  metadata: getRouteMetadata,
  input: learningPathListQuerySchema,
  output: learningPathListResponseSchema,
  handler: async ({ tx, ctx, input }) => await listLearningPaths(tx, ctx, input),
});

export const POST = createTenantRoute<CreateLearningPathBody, CreateLearningPathResponse>({
  metadata: postRouteMetadata,
  body: createLearningPathBodySchema,
  output: createLearningPathResponseSchema,
  handler: async ({ tx, ctx, input }) => await createLearningPathDraft(tx, ctx, input),
});
