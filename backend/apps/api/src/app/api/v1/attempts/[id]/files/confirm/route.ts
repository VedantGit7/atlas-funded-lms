import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";
import {
  attemptFileConfirmBodySchema,
  attemptFileResponseSchema,
} from "../../../../../../../server/attempts/attempt-files.schemas";
import { confirmAttemptFile } from "../../../../../../../server/attempts/attempt-files.service";
import { postAttemptFileRouteMetadata } from "../upload/route.metadata";

/** Checks the uploaded file; the learner then saves it as their answer. */
export const POST = createTenantRoute<
  z.output<typeof attemptFileConfirmBodySchema>,
  z.output<typeof attemptFileResponseSchema>,
  typeof uuidParamSchema
>({
  metadata: postAttemptFileRouteMetadata,
  params: uuidParamSchema,
  body: attemptFileConfirmBodySchema,
  output: attemptFileResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return await confirmAttemptFile(tx, ctx, attemptId, input);
  },
});
