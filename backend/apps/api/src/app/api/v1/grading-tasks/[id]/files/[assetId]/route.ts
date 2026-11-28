import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attemptFileDownloadResponseSchema,
  attemptFileParamsSchema,
} from "../../../../../../../server/attempts/attempt-files.schemas";
import { getGradingTaskFile } from "../../../../../../../server/attempts/attempt-files.service";
import { getGradingTaskFileRouteMetadata } from "./route.metadata";

/** A short-lived link to a learner's file in the attempt being graded. */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof attemptFileDownloadResponseSchema>,
  typeof attemptFileParamsSchema
>({
  metadata: getGradingTaskFileRouteMetadata,
  params: attemptFileParamsSchema,
  output: attemptFileDownloadResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const taskId = params["id"];
    const assetId = params["assetId"];
    if (!taskId || !assetId) throw new Error("Missing grading task or file id");
    return await getGradingTaskFile(tx, ctx, taskId, assetId);
  },
});
