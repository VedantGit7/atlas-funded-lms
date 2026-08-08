import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { getLearningPathProgress } from "../../../../../../server/learning-paths/learning-path.service";
import {
  learningPathIdParamsSchema,
  pathProgressResponseSchema,
} from "../../../../../../server/learning-paths/learning-path.schemas";
import { getRouteMetadata } from "./route.metadata";

type PathProgressResponse = z.output<typeof pathProgressResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  PathProgressResponse,
  typeof learningPathIdParamsSchema
>({
  metadata: getRouteMetadata,
  params: learningPathIdParamsSchema,
  output: pathProgressResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const pathId = params["id"];
    if (!pathId) throw new Error("Missing learning path id");
    return await getLearningPathProgress(tx, ctx, pathId);
  },
});
