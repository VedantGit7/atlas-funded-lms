import { clientApi } from "../../lib/client-api";
import type { z } from "zod";
import type {
  competencyHistoryResponseSchema,
  competencySignalsListResponseSchema,
  memberCompetencyResponseSchema,
  myCompetencyResponseSchema,
} from "@atlas/contracts/competency/competency-projection.schemas";

type MyCompetencyResponse = z.infer<typeof myCompetencyResponseSchema>;
type CompetencyHistoryResponse = z.infer<typeof competencyHistoryResponseSchema>;
type MemberCompetencyResponse = z.infer<typeof memberCompetencyResponseSchema>;
type CompetencySignalsListResponse = z.infer<typeof competencySignalsListResponseSchema>;

export const competencyApiClient = {
  async getMyCompetency(): Promise<MyCompetencyResponse> {
    return clientApi.get<MyCompetencyResponse>("/api/v1/me/competency");
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
    return clientApi.get<CompetencyHistoryResponse>(`/api/v1/me/competency/history${suffix}`);
  },

  async getMemberCompetency(membershipId: string): Promise<MemberCompetencyResponse> {
    return clientApi.get<MemberCompetencyResponse>(`/api/v1/members/${membershipId}/competency`);
  },

  async listCompetencySignals(query?: {
    cursor?: string;
    limit?: number;
    membershipId?: string;
    dimensionId?: string;
    signalSourceKey?: string;
  }): Promise<CompetencySignalsListResponse> {
    const params = new URLSearchParams();
    if (query?.cursor) params.set("cursor", query.cursor);
    if (query?.limit != null) params.set("limit", String(query.limit));
    if (query?.membershipId) params.set("membershipId", query.membershipId);
    if (query?.dimensionId) params.set("dimensionId", query.dimensionId);
    if (query?.signalSourceKey) params.set("signalSourceKey", query.signalSourceKey);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return clientApi.get<CompetencySignalsListResponse>(`/api/v1/competency-signals${suffix}`);
  },
};
