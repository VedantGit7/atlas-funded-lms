export type CompetencyDimensionDto = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScoringProfileDto = {
  id: string;
  key: string;
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  activeConfigVersionId: string | null;
  activeVersion: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CompetencyBandDto = {
  id: string;
  key: string;
  label: string;
  minScore: number;
  maxScore: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ScoringConfigSnapshot = {
  profile: {
    id: string;
    key: string;
    name: string;
    status: string;
  };
  dimensions: CompetencyDimensionDto[];
  bands: CompetencyBandDto[];
  signalSources: Array<{
    id: string;
    key: string;
    sourceContext: string;
    configJson: Record<string, unknown> | null;
  }>;
  rulesJson: Record<string, unknown>;
};

export type PublishedScoringConfigDto = {
  profileId: string;
  configVersionId: string;
  version: number;
  activatedAt: string;
  activeConfigVersionId: string;
};
