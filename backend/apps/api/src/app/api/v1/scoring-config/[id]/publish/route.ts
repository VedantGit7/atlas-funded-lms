import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { publishScoringConfig } from "../../../../../../server/competency/scoring-config.service";
import {
  publishScoringConfigBodySchema,
  publishScoringConfigResponseSchema,
  scoringConfigPublishParamsSchema,
} from "../../../../../../server/competency/competency-config.schemas";
import { publishRouteMetadata } from "./route.metadata";

type PublishScoringConfigBody = z.output<typeof publishScoringConfigBodySchema>;
type PublishScoringConfigResponse = z.output<typeof publishScoringConfigResponseSchema>;

export const POST = createTenantRoute<
  PublishScoringConfigBody,
  PublishScoringConfigResponse,
  typeof scoringConfigPublishParamsSchema
>({
  metadata: publishRouteMetadata,
  params: scoringConfigPublishParamsSchema,
  body: publishScoringConfigBodySchema,
  output: publishScoringConfigResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return await publishScoringConfig(tx, ctx, profileId, input);
  },
});
