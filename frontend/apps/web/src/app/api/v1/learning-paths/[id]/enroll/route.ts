import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { enrollCurrentMemberInPath } from "../../../../../../server/learning-paths/learning-path.service";
import {
  enrollLearningPathBodySchema,
  enrollLearningPathResponseSchema,
  learningPathIdParamsSchema,
} from "../../../../../../server/learning-paths/learning-path.schemas";
import { postRouteMetadata } from "./route.metadata";

type EnrollLearningPathBody = z.output<typeof enrollLearningPathBodySchema>;
type EnrollLearningPathResponse = z.output<typeof enrollLearningPathResponseSchema>;

export const POST = createTenantRoute<
  EnrollLearningPathBody,
  EnrollLearningPathResponse,
  typeof learningPathIdParamsSchema
>({
  metadata: postRouteMetadata,
  params: learningPathIdParamsSchema,
  body: enrollLearningPathBodySchema,
  output: enrollLearningPathResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");
    return await enrollCurrentMemberInPath(tx, ctx, pathId);
  },
});
