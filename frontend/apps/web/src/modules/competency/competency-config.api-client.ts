"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import type {
  competencyBandListResponseSchema,
  competencyDimensionDetailResponseSchema,
  competencyDimensionListResponseSchema,
  createDimensionBodySchema,
  createScoringProfileBodySchema,
  deleteDimensionResponseSchema,
  publishScoringConfigBodySchema,
  publishScoringConfigResponseSchema,
  replaceBandsBodySchema,
  scoringProfileDetailResponseSchema,
  scoringProfileListResponseSchema,
  updateDimensionBodySchema,
  updateScoringProfileBodySchema,
} from "@atlas/contracts/competency/competency-config.schemas";

type CompetencyDimensionListResponse = z.infer<typeof competencyDimensionListResponseSchema>;
type CompetencyDimensionDetailResponse = z.infer<typeof competencyDimensionDetailResponseSchema>;
type DeleteDimensionResponse = z.infer<typeof deleteDimensionResponseSchema>;
type ScoringProfileListResponse = z.infer<typeof scoringProfileListResponseSchema>;
type ScoringProfileDetailResponse = z.infer<typeof scoringProfileDetailResponseSchema>;
type CompetencyBandListResponse = z.infer<typeof competencyBandListResponseSchema>;
type PublishScoringConfigResponse = z.infer<typeof publishScoringConfigResponseSchema>;
type CreateDimensionBody = z.infer<typeof createDimensionBodySchema>;
type UpdateDimensionBody = z.infer<typeof updateDimensionBodySchema>;
type CreateScoringProfileBody = z.infer<typeof createScoringProfileBodySchema>;
type UpdateScoringProfileBody = z.infer<typeof updateScoringProfileBodySchema>;
type ReplaceBandsBody = z.infer<typeof replaceBandsBodySchema>;
type PublishScoringConfigBody = z.infer<typeof publishScoringConfigBodySchema>;

export async function listCompetencyDimensions(): Promise<CompetencyDimensionListResponse> {
  return clientApi.get<CompetencyDimensionListResponse>("/api/v1/competency-dimensions");
}

export async function createCompetencyDimension(
  body: CreateDimensionBody,
): Promise<CompetencyDimensionDetailResponse> {
  return clientApi.post<CompetencyDimensionDetailResponse>(
    "/api/v1/competency-dimensions",
    body,
    "competency-dimension-create",
  );
}

export async function updateCompetencyDimension(
  dimensionId: string,
  body: UpdateDimensionBody,
): Promise<CompetencyDimensionDetailResponse> {
  return clientApi.put<CompetencyDimensionDetailResponse>(
    `/api/v1/competency-dimensions/${dimensionId}`,
    body,
    "competency-dimension-update",
  );
}

export async function deleteCompetencyDimension(
  dimensionId: string,
): Promise<DeleteDimensionResponse> {
  return clientApi.delete<DeleteDimensionResponse>(
    `/api/v1/competency-dimensions/${dimensionId}`,
    "competency-dimension-delete",
  );
}

export async function listScoringProfiles(): Promise<ScoringProfileListResponse> {
  return clientApi.get<ScoringProfileListResponse>("/api/v1/scoring-profiles");
}

export async function createScoringProfile(
  body: CreateScoringProfileBody,
): Promise<ScoringProfileDetailResponse> {
  return clientApi.post<ScoringProfileDetailResponse>(
    "/api/v1/scoring-profiles",
    body,
    "scoring-profile-create",
  );
}

export async function updateScoringProfile(
  profileId: string,
  body: UpdateScoringProfileBody,
): Promise<ScoringProfileDetailResponse> {
  return clientApi.put<ScoringProfileDetailResponse>(
    `/api/v1/scoring-profiles/${profileId}`,
    body,
    "scoring-profile-update",
  );
}

export async function listProfileBands(profileId: string): Promise<CompetencyBandListResponse> {
  return clientApi.get<CompetencyBandListResponse>(`/api/v1/scoring-profiles/${profileId}/bands`);
}

export async function replaceProfileBands(
  profileId: string,
  body: ReplaceBandsBody,
): Promise<CompetencyBandListResponse> {
  return clientApi.put<CompetencyBandListResponse>(
    `/api/v1/scoring-profiles/${profileId}/bands`,
    body,
    "competency-bands-replace",
  );
}

export async function publishScoringConfig(
  profileId: string,
  body: PublishScoringConfigBody = {},
): Promise<PublishScoringConfigResponse> {
  return clientApi.post<PublishScoringConfigResponse>(
    `/api/v1/scoring-config/${profileId}/publish`,
    body,
    "scoring-config-publish",
  );
}

export function formatCompetencyConfigApiError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.requestId ? `${error.message} (Request ID: ${error.requestId})` : error.message;
  }
  return "Something went wrong.";
}
