export type QuestStep =
  | { type: "complete_lessons"; count: number; courseId?: string | undefined }
  | { type: "earn_xp"; amount: number }
  | { type: "maintain_streak"; streakKey: string; days: number }
  | { type: "earn_badge"; badgeKey: string }
  | { type: "complete_assessment"; minScorePercent: number; assessmentId?: string | undefined }
  | { type: "event_count"; eventType: string; count: number };

export type QuestRewards = {
  xp?: number | undefined;
  badgeKey?: string | undefined;
};

export type QuestDto = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  questType: string;
  criteria: { steps: QuestStep[] };
  rewards: QuestRewards;
  startsAt: string | null;
  endsAt: string | null;
  courseId: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

export type QuestStepProgress = {
  progress: number;
  target: number;
  completedAt: string | null;
};

export const QUEST_STEP_TYPE_LABELS: Record<QuestStep["type"], string> = {
  complete_lessons: "Complete lessons",
  earn_xp: "Earn XP",
  maintain_streak: "Maintain a streak",
  earn_badge: "Earn a badge",
  complete_assessment: "Pass an assessment",
  event_count: "Repeat an activity",
};

export function describeQuestStep(step: QuestStep): string {
  switch (step.type) {
    case "complete_lessons":
      return `Complete ${String(step.count)} lesson(s)${step.courseId ? " in the linked course" : ""}`;
    case "earn_xp":
      return `Earn ${String(step.amount)} XP`;
    case "maintain_streak":
      return `Reach a ${String(step.days)}-day ${step.streakKey.replace(/[_-]/g, " ")} streak`;
    case "earn_badge":
      return `Earn the “${step.badgeKey}” badge`;
    case "complete_assessment":
      return `Pass an assessment with ≥ ${String(step.minScorePercent)}%`;
    case "event_count":
      return `${step.eventType.replace(/[._]/g, " ")} × ${String(step.count)}`;
  }
}

export function describeQuestRewards(rewards: QuestRewards): string {
  const parts: string[] = [];
  if (rewards.xp) parts.push(`${String(rewards.xp)} XP`);
  if (rewards.badgeKey) parts.push(`badge “${rewards.badgeKey}”`);
  return parts.length > 0 ? parts.join(" + ") : "No reward";
}
