import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  listProfileBands,
  replaceProfileBands,
} from "../../../../../../server/competency/scoring-config.service";
import {
  competencyBandListResponseSchema,
  replaceBandsBodySchema,
  scoringProfileIdParamsSchema,
} from "../../../../../../server/competency/competency-config.schemas";
import { getRouteMetadata, putRouteMetadata } from "./route.metadata";

type ReplaceBandsBody = z.output<typeof replaceBandsBodySchema>;
type CompetencyBandListResponse = z.output<typeof competencyBandListResponseSchema>;

export const GET = createTenantRoute<
  Record<string, never>,
  CompetencyBandListResponse,
  typeof scoringProfileIdParamsSchema
>({
  metadata: getRouteMetadata,
  params: scoringProfileIdParamsSchema,
  output: competencyBandListResponseSchema,
  handler: async ({ tx, params }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return await listProfileBands(tx, profileId);
  },
});

export const PUT = createTenantRoute<
  ReplaceBandsBody,
  CompetencyBandListResponse,
  typeof scoringProfileIdParamsSchema
>({
  metadata: putRouteMetadata,
  params: scoringProfileIdParamsSchema,
  body: replaceBandsBodySchema,
  output: competencyBandListResponseSchema,
  handler: async ({ tx, ctx, params, input }) => {
    const profileId = params["id"];
    if (!profileId) throw new Error("Missing scoring profile id");
    return await replaceProfileBands(tx, ctx, profileId, input);
  },
});
