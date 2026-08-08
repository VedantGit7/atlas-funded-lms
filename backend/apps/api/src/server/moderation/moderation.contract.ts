import type { ModerationStatus } from "./moderation.types";

export const MODERATION_CASE_STATUSES = [
  "OPEN",
  "REVIEWING",
  "ACTIONED",
  "REJECTED",
  "CLOSED",
] as const satisfies readonly ModerationStatus[];

export const APPEAL_STATUSES = ["open", "upheld", "rejected"] as const;

export const MODERATION_TARGET_TYPES = ["post", "comment"] as const;

export const MODERATION_CASE_DECISION_KEYS = [
  "begin_review",
  "actioned",
  "rejected",
  "closed",
] as const;

export const APPEAL_REVIEW_OUTCOMES = ["uphold", "reject"] as const;

export const REGISTERED_MODERATION_CONTENT_ACTIONS = ["delete"] as const;

export type ModerationCaseDecisionKey = (typeof MODERATION_CASE_DECISION_KEYS)[number];
export type RegisteredModerationContentAction =
  (typeof REGISTERED_MODERATION_CONTENT_ACTIONS)[number];
export type AppealReviewOutcome = (typeof APPEAL_REVIEW_OUTCOMES)[number];
export type ModerationTargetType = (typeof MODERATION_TARGET_TYPES)[number];

const CASE_TRANSITIONS: Record<
  ModerationCaseDecisionKey,
  { from: readonly ModerationStatus[]; to: ModerationStatus }
> = {
  begin_review: { from: ["OPEN"], to: "REVIEWING" },
  actioned: { from: ["REVIEWING"], to: "ACTIONED" },
  rejected: { from: ["REVIEWING"], to: "REJECTED" },
  closed: { from: ["REVIEWING", "ACTIONED"], to: "CLOSED" },
};

export function resolveCaseStatusAfterDecision(args: {
  currentStatus: ModerationStatus;
  decisionKey: ModerationCaseDecisionKey;
}): ModerationStatus | null {
  const rule = CASE_TRANSITIONS[args.decisionKey];
  if (!rule.from.includes(args.currentStatus)) {
    return null;
  }

  return rule.to;
}

export function resolveCaseStatusAfterAppealUphold(args: {
  currentStatus: ModerationStatus;
  nextCaseStatus: "REJECTED" | "CLOSED";
}): ModerationStatus | null {
  if (args.currentStatus !== "ACTIONED") {
    return null;
  }

  return args.nextCaseStatus;
}

export function assertRegisteredContentAction(action: string): RegisteredModerationContentAction {
  if (
    !REGISTERED_MODERATION_CONTENT_ACTIONS.includes(action as RegisteredModerationContentAction)
  ) {
    throw new Error("UNREGISTERED_CONTENT_ACTION");
  }

  return action as RegisteredModerationContentAction;
}
