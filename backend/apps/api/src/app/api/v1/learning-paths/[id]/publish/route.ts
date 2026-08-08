import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { submitLearningPathForReview } from "../../../../../../server/learning-paths/learning-path.service";
import {
  learningPathIdParamsSchema,
  publishLearningPathBodySchema,
  publishLearningPathResponseSchema,
} from "../../../../../../server/learning-paths/learning-path.schemas";
import { publishRouteMetadata } from "./route.metadata";

type PublishLearningPathBody = z.output<typeof publishLearningPathBodySchema>;
type PublishLearningPathResponse = z.output<typeof publishLearningPathResponseSchema>;

export const POST = createTenantRoute<
  PublishLearningPathBody,
  PublishLearningPathResponse,
  typeof learningPathIdParamsSchema
>({
  metadata: publishRouteMetadata,
  params: learningPathIdParamsSchema,
  body: publishLearningPathBodySchema,
  output: publishLearningPathResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");
    return await submitLearningPathForReview(tx, ctx, pathId, input);
  },
});
