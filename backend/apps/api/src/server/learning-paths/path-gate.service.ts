import type {
  GateEvaluationState,
  PathGateType,
  PathStepProgressStatus,
} from "./learning-path.types";

export type GateEvaluationContext = {
  membershipId: string;
  stepId: string;
  stepPosition: number;
  stepRefId: string | null;
  previousStepCompleted: boolean;
  assessmentPassed: boolean;
  competencyBandSatisfied: boolean;
  manualApproved: boolean;
  timeGateSatisfied: boolean;
};

export function evaluateGateState(
  gateType: PathGateType,
  ctx: GateEvaluationContext,
): GateEvaluationState {
  switch (gateType) {
    case "open":
      return "satisfied";
    case "previous_step_completed":
      return ctx.previousStepCompleted ? "satisfied" : "locked";
    case "assessment_passed":
      return ctx.assessmentPassed ? "satisfied" : "locked";
    case "competency_band":
      return ctx.competencyBandSatisfied ? "satisfied" : "locked";
    case "manual":
      return ctx.manualApproved ? "satisfied" : "locked";
    case "time_based":
      return ctx.timeGateSatisfied ? "satisfied" : "locked";
    default:
      return "locked";
  }
}

export function stepLockedFromGates(gateStates: GateEvaluationState[]): boolean {
  if (gateStates.length === 0) return false;
  return gateStates.some((state) => state !== "satisfied");
}

export function deriveProgressStatus(args: {
  locked: boolean;
  completed: boolean;
  inProgress: boolean;
}): PathStepProgressStatus {
  if (args.completed) return "completed";
  if (args.locked) return "locked";
  if (args.inProgress) return "in_progress";
  return "unlocked";
}

export function compareBandKeys(args: {
  currentBandKey: string | null;
  requiredBandKey: string;
  currentRank: number | null;
  requiredRank: number | null;
}): boolean {
  if (!args.currentBandKey) return false;
  if (args.currentBandKey === args.requiredBandKey) return true;

  if (args.currentRank != null && args.requiredRank != null) {
    return args.currentRank >= args.requiredRank;
  }

  return false;
}

export function readAssessmentIdFromGateConfig(
  config: Record<string, unknown>,
  stepRefId: string | null,
): string | null {
  const fromConfig = config["assessmentId"];
  if (typeof fromConfig === "string") return fromConfig;
  return stepRefId;
}

export function readCompetencyBandConfig(config: Record<string, unknown>): {
  bandKey: string | null;
  scoringProfileId: string | null;
  compositeKey: string | null;
} {
  const bandKey =
    typeof config["bandKey"] === "string"
      ? config["bandKey"]
      : typeof config["minBandKey"] === "string"
        ? config["minBandKey"]
        : null;

  const scoringProfileId =
    typeof config["scoringProfileId"] === "string" ? config["scoringProfileId"] : null;
  const compositeKey = typeof config["compositeKey"] === "string" ? config["compositeKey"] : null;

  return { bandKey, scoringProfileId, compositeKey };
}

export function readTimeBasedGateConfig(config: Record<string, unknown>): {
  availableFrom: Date | null;
  daysSinceEnroll: number | null;
} {
  const availableFromRaw = config["availableFrom"];
  const availableFrom =
    typeof availableFromRaw === "string" && !Number.isNaN(Date.parse(availableFromRaw))
      ? new Date(availableFromRaw)
      : null;

  const daysSinceEnrollRaw = config["daysSinceEnroll"];
  const daysSinceEnroll =
    typeof daysSinceEnrollRaw === "number" && Number.isFinite(daysSinceEnrollRaw)
      ? daysSinceEnrollRaw
      : null;

  return { availableFrom, daysSinceEnroll };
}

export function isTimeGateSatisfied(args: {
  availableFrom: Date | null;
  daysSinceEnroll: number | null;
  enrolledAt: Date | null;
  now: Date;
}): boolean {
  if (args.availableFrom) {
    return args.now.getTime() >= args.availableFrom.getTime();
  }

  if (args.daysSinceEnroll != null && args.enrolledAt) {
    const unlockAt = args.enrolledAt.getTime() + args.daysSinceEnroll * 24 * 60 * 60 * 1000;
    return args.now.getTime() >= unlockAt;
  }

  return false;
}

export function stepHref(stepType: string, refId: string | null): string | null {
  if (!refId) return null;
  if (stepType === "course") return `/courses/${refId}`;
  if (stepType === "assessment") return `/assessments/${refId}`;
  if (stepType === "path") return `/paths/${refId}`;
  return null;
}
