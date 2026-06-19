export type PathLifecycleStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export type PathType = "roadmap" | "program";

export type PathStepType = "course" | "assessment" | "path";

export type PathGateType =
  | "open"
  | "previous_step_completed"
  | "assessment_passed"
  | "competency_band"
  | "manual";

export type PathStepProgressStatus = "locked" | "unlocked" | "in_progress" | "completed";

export type GateEvaluationState = "satisfied" | "locked" | "pending";

export type PathGateConfig = Record<string, unknown>;

export type PathStepDto = {
  id: string;
  stepType: PathStepType;
  refId: string | null;
  title: string;
  position: number;
  gates: PathGateDto[];
};

export type PathGateDto = {
  id: string;
  gateType: PathGateType;
  config: PathGateConfig;
};

export type PathSummaryDto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pathType: PathType;
  status: PathLifecycleStatus;
  updatedAt: string;
  createdAt: string;
};

export type PathDetailDto = PathSummaryDto & {
  steps: PathStepDto[];
  enrollmentStatus: "enrolled" | "not_enrolled";
};

export type PathProgressStepDto = {
  stepId: string;
  position: number;
  title: string;
  stepType: PathStepType;
  refId: string | null;
  progressStatus: PathStepProgressStatus;
  locked: boolean;
  gates: Array<{
    id: string;
    gateType: PathGateType;
    state: GateEvaluationState;
    config: PathGateConfig;
  }>;
  href: string | null;
};

export type PathProgressDto = {
  pathId: string;
  enrolled: boolean;
  enrollmentId: string | null;
  completedStepCount: number;
  totalStepCount: number;
  currentStepId: string | null;
  nextAction: {
    type: "enroll" | "continue" | "complete" | "wait_for_gate";
    stepId: string | null;
    label: string;
  };
  steps: PathProgressStepDto[];
};
