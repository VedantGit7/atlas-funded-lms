import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { SignedUploadResponseSchema } from "@atlas/storage/schemas/asset-reference";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import { attemptFileUploadBodySchema } from "../../../../../../../server/attempts/attempt-files.schemas";
import { createAttemptFileUpload } from "../../../../../../../server/attempts/attempt-files.service";
import { postAttemptFileRouteMetadata } from "./route.metadata";

/** Asks for an upload of a learner's answer file. */
export const POST = createTenantRoute<
  z.output<typeof attemptFileUploadBodySchema>,
  z.output<typeof SignedUploadResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postAttemptFileRouteMetadata,
  params: uuidParamSchema,
  body: attemptFileUploadBodySchema,
  output: SignedUploadResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return await createAttemptFileUpload(tx, ctx, attemptId, input);
  },
});
