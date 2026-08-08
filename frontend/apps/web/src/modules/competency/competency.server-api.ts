import { serverApi } from "../../lib/server-api";
import type { z } from "zod";
import type {
  competencyHistoryResponseSchema,
  myCompetencyResponseSchema,
} from "@atlas/contracts/competency/competency-projection.schemas";

type MyCompetencyResponse = z.infer<typeof myCompetencyResponseSchema>;
type CompetencyHistoryResponse = z.infer<typeof competencyHistoryResponseSchema>;

export const competencyServerApi = {
  async getMyCompetency(): Promise<MyCompetencyResponse> {
    return serverApi.get<MyCompetencyResponse>("/api/v1/me/competency");
  },

  async getMyCompetencyHistory(query?: {
    cursor?: string;
    limit?: number;
    scoringProfileId?: string;
  }): Promise<CompetencyHistoryResponse> {
    const params = new URLSearchParams();
    if (query?.cursor) params.set("cursor", query.cursor);
    if (query?.limit != null) params.set("limit", String(query.limit));
    if (query?.scoringProfileId) params.set("scoringProfileId", query.scoringProfileId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return serverApi.get<CompetencyHistoryResponse>(`/api/v1/me/competency/history${suffix}`);
  },
};
