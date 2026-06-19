import type { z } from "zod";
import { serverApi } from "../../lib/server-api";
import type {
  competencyBandListResponseSchema,
  competencyDimensionListResponseSchema,
  scoringProfileListResponseSchema,
} from "../../server/competency/competency-config.schemas";

type CompetencyDimensionListResponse = z.infer<typeof competencyDimensionListResponseSchema>;
type ScoringProfileListResponse = z.infer<typeof scoringProfileListResponseSchema>;
type CompetencyBandListResponse = z.infer<typeof competencyBandListResponseSchema>;

export const competencyConfigServerApi = {
  async listDimensions(): Promise<CompetencyDimensionListResponse> {
    return serverApi.get<CompetencyDimensionListResponse>("/api/v1/competency-dimensions");
  },

  async listScoringProfiles(): Promise<ScoringProfileListResponse> {
    return serverApi.get<ScoringProfileListResponse>("/api/v1/scoring-profiles");
  },

  async listProfileBands(profileId: string): Promise<CompetencyBandListResponse> {
    return serverApi.get<CompetencyBandListResponse>(`/api/v1/scoring-profiles/${profileId}/bands`);
  },
};
