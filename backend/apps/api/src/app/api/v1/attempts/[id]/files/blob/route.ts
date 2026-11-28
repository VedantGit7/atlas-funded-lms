import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { attemptFileBlobResponseSchema } from "../../../../../../../server/attempts/attempt-files.schemas";
import {
  parseAttemptFileBlobRequest,
  storeAttemptFileBlob,
  type AttemptFileBlobBody,
} from "../../../../../../../server/attempts/attempt-files.service";
import { postAttemptFileRouteMetadata } from "../upload/route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local development only: stores the file when there is no R2 to upload to. */
export const POST = createTenantRoute<
  AttemptFileBlobBody,
  z.output<typeof attemptFileBlobResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postAttemptFileRouteMetadata,
  params: uuidParamSchema,
  readBody: parseAttemptFileBlobRequest,
  output: attemptFileBlobResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return await storeAttemptFileBlob(tx, ctx, attemptId, input);
  },
});
