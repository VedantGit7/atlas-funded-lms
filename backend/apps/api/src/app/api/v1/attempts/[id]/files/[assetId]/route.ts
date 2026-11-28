import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  attemptFileDownloadResponseSchema,
  attemptFileParamsSchema,
} from "../../../../../../../server/attempts/attempt-files.schemas";
import { getOwnAttemptFile } from "../../../../../../../server/attempts/attempt-files.service";
import { getAttemptFileRouteMetadata } from "./route.metadata";

/** A short-lived link to a file the learner uploaded in this attempt. */
export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof attemptFileDownloadResponseSchema>,
  typeof attemptFileParamsSchema
>({
  metadata: getAttemptFileRouteMetadata,
  params: attemptFileParamsSchema,
  output: attemptFileDownloadResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const attemptId = params["id"];
    const assetId = params["assetId"];
    if (!attemptId || !assetId) throw new Error("Missing attempt or file id");
    return await getOwnAttemptFile(tx, ctx, attemptId, assetId);
  },
});
