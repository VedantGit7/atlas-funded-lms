// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type CompetencySignalDto = {
  id: string;
  membershipId: string;
  dimensionId: string;
  dimensionKey: string;
  signalSourceKey: string;
  sourceEventId: string | null;
  rawScore: number;
  weight: number;
  occurredAt: string;
};

export type CompetencyScoreDto = {
  dimensionId: string;
  dimensionKey: string;
  dimensionName: string;
  scoringProfileId: string;
  scoringProfileKey: string;
  score: number;
  bandKey: string | null;
  bandLabel: string | null;
  calculatedAt: string;
  configVersionId: string;
};

export type CompositeReadinessDto = {
  compositeKey: string;
  score: number;
  bandKey: string;
  calculatedAt: string;
  scoringProfileId: string;
};

export type CompetencySnapshotDto = {
  id: string;
  scoringProfileId: string;
  scoringProfileKey: string;
  occurredAt: string;
  scores: Array<{
    dimensionId: string;
    dimensionKey: string;
    score: number;
    bandKey: string | null;
  }>;
};

export type MappedCompetencySignal = {
  membershipId: string;
  dimensionId: string;
  signalSourceKey: string;
  rawScore: number;
  weight: number;
  itemId: string;
  metadataJson?: Record<string, unknown>;
};

export type ActiveScoringProfile = {
  id: string;
  key: string;
  activeConfigVersionId: string;
};
