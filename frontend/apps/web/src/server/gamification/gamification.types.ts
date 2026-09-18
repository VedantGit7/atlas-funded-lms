// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type GamificationXpRule = {
  key: string;
  eventType: string;
  points: number;
  condition?: "pass";
};

export type GamificationLevelThreshold = {
  levelKey: string;
  minXp: number;
};

export type GamificationStreakRule = {
  streakKey: string;
  eventTypes: string[];
};

export type GamificationRulesConfig = {
  xpRules: GamificationXpRule[];
  levelThresholds: GamificationLevelThreshold[];
  streaks: GamificationStreakRule[];
  defaultFreezeInventory: number;
};

export type BadgeCriteria =
  | { type: "xp_total"; minXp: number }
  | { type: "streak_current"; streakKey: string; minCount: number }
  | { type: "event_count"; eventType: string; minCount: number };

export type LeaderboardScopeType = "tenant" | "course";

export type LeaderboardConfig = {
  scopeType: LeaderboardScopeType;
  courseId?: string;
  privacyMode: "anonymous_rank";
  maxEntries: number;
};

export type SanitizedLeaderboardEntry = {
  rank: number;
  label: string;
  metricValue: number;
  isSelf: boolean;
};

export type LeaderboardSnapshotPayload = {
  entries: SanitizedLeaderboardEntry[];
  callerRank: number | null;
  callerMetricValue: number | null;
  calculatedAt: string;
};
