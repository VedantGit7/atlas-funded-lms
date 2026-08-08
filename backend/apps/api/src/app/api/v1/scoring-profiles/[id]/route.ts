import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { updateScoringProfile } from "../../../../../server/competency/competency-config.service";
import {
  scoringProfileDetailResponseSchema,
  scoringProfileIdParamsSchema,
  updateScoringProfileBodySchema,
} from "../../../../../server/competency/competency-config.schemas";
import { putRouteMetadata } from "./route.metadata";

type UpdateScoringProfileBody = z.output<typeof updateScoringProfileBodySchema>;
type ScoringProfileDetailResponse = z.output<typeof scoringProfileDetailResponseSchema>;

export const PUT = createTenantRoute<
  UpdateScoringProfileBody,
  ScoringProfileDetailResponse,
  typeof scoringProfileIdParamsSchema
>({
  metadata: putRouteMetadata,
  params: scoringProfileIdParamsSchema,
  body: updateScoringProfileBodySchema,
  output: scoringProfileDetailResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return await updateScoringProfile(tx, ctx, profileId, input);
  },
});
