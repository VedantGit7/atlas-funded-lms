import type { GamificationRulesConfig } from "./gamification.types";

export const DEFAULT_GAMIFICATION_RULES: GamificationRulesConfig = {
  xpRules: [
    { key: "lesson.completed", eventType: "lesson.completed", points: 10 },
    { key: "path.step_completed", eventType: "path.step_completed", points: 15 },
    { key: "assessment.submitted", eventType: "assessment.submitted", points: 5 },
    {
      key: "assessment.graded.pass",
      eventType: "assessment.graded",
      condition: "pass",
      points: 20,
    },
    {
      key: "practice.session_completed",
      eventType: "practice.session_completed",
      points: 8,
    },
    {
      key: "diagnostic.completed",
      eventType: "diagnostic.completed",
      points: 25,
    },
  ],
  levelThresholds: [
    { levelKey: "level_1", minXp: 0 },
    { levelKey: "level_2", minXp: 100 },
    { levelKey: "level_3", minXp: 300 },
    { levelKey: "level_4", minXp: 600 },
    { levelKey: "level_5", minXp: 1000 },
  ],
  streaks: [
    {
      streakKey: "daily_learning",
      eventTypes: [
        "lesson.completed",
        "path.step_completed",
        "assessment.submitted",
        "practice.session_completed",
      ],
    },
    {
      streakKey: "practice_daily",
      eventTypes: ["practice.session_completed"],
    },
    {
      streakKey: "practice_weekly",
      eventTypes: ["practice.session_completed"],
      cadence: "weekly",
    },
  ],
  defaultFreezeInventory: 3,
  leaderboardsPublic: true,
  streakBonuses: [],
};

export const DEFAULT_PASS_MARK_PERCENT = 70;
