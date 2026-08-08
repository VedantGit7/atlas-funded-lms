import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { AttemptParamsSchema } from "@atlas/api-server/assessments/schemas";
import { attemptRunnerResponseSchema } from "@atlas/api-server/assessments/assessment-response-schemas";
import { getAttempt } from "../../../../../server/attempts/attempts.service";
import { getAttemptRouteMetadata } from "./route.metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof attemptRunnerResponseSchema>,
  typeof AttemptParamsSchema
>({
  metadata: getAttemptRouteMetadata,
  params: AttemptParamsSchema,
  output: attemptRunnerResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const attemptId = params["id"];
    if (!attemptId) throw new Error("Missing attempt id");
    return getAttempt(tx, ctx, attemptId);
  },
});
