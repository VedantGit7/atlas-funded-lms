import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  createScoringProfile,
  listTenantScoringProfiles,
} from "../../../../server/competency/competency-config.service";
import {
  createScoringProfileBodySchema,
  scoringProfileDetailResponseSchema,
  scoringProfileListResponseSchema,
} from "../../../../server/competency/competency-config.schemas";
import { getRouteMetadata, postRouteMetadata } from "./route.metadata";

type CreateScoringProfileBody = z.output<typeof createScoringProfileBodySchema>;
type ScoringProfileListResponse = z.output<typeof scoringProfileListResponseSchema>;
type ScoringProfileDetailResponse = z.output<typeof scoringProfileDetailResponseSchema>;

export const GET = createTenantRoute<Record<string, never>, ScoringProfileListResponse>({
  metadata: getRouteMetadata,
  output: scoringProfileListResponseSchema,
  handler: async ({ tx }) => await listTenantScoringProfiles(tx),
});

export const POST = createTenantRoute<CreateScoringProfileBody, ScoringProfileDetailResponse>({
  metadata: postRouteMetadata,
  body: createScoringProfileBodySchema,
  output: scoringProfileDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => await createScoringProfile(tx, ctx, input),
});
