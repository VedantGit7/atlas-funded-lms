export type DiagnosticSessionStatus = "started" | "completed" | "merged";

export type DiagnosticQuestionOption = {
  id: string;
  optionJson: Record<string, unknown>;
  position: number;
};

export type DiagnosticQuestion = {
  assessmentItemId: string;
  itemId: string;
  itemTypeKey: string;
  position: number;
  points: number;
  required: boolean;
  contentJson: Record<string, unknown>;
  options: DiagnosticQuestionOption[];
};

export type DiagnosticDimensionScore = {
  dimensionId: string;
  dimensionKey: string;
  dimensionName: string;
  score: number;
  bandKey: string | null;
  bandLabel: string | null;
};

export type DiagnosticNextAction = {
  key: string;
  title: string;
  description: string;
};

export type DiagnosticScorecard = {
  partial: boolean;
  overallScore: number | null;
  overallBandKey: string | null;
  overallBandLabel: string | null;
  interpretation: string;
  dimensions: DiagnosticDimensionScore[];
  nextAction: DiagnosticNextAction;
};

export type DiagnosticSessionMetadata = {
  questionProjection?: DiagnosticQuestion[];
  answers?: Record<
    string,
    {
      assessmentItemId: string;
      answerJson: Record<string, unknown>;
    }
  >;
  partialScorecard?: DiagnosticScorecard;
};

export type DiagnosticSessionRow = {
  id: string;
  tenant_id: string;
  anonymous_id: string | null;
  membership_id: string | null;
  assessment_id: string | null;
  attempt_id: string | null;
  status: string;
  ip_hash: string | null;
  user_agent_hash: string | null;
  started_at: Date;
  completed_at: Date | null;
  merge_json: unknown;
  metadata_json: unknown;
};
