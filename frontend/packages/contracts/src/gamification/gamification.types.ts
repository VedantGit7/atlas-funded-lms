export type GamificationXpRule = {
  key: string;
  eventType: string;
  points: number;
  condition?: "pass" | undefined;
};

export type GamificationLevelThreshold = {
  levelKey: string;
  minXp: number;
};

export type GamificationStreakRule = {
  streakKey: string;
  eventTypes: string[];
  cadence?: "daily" | "weekly";
  groupScoped?: boolean;
};

export type GamificationStreakBonus = {
  days: number;
  bonusXp: number;
};

export type GamificationRulesConfig = {
  xpRules: GamificationXpRule[];
  levelThresholds: GamificationLevelThreshold[];
  streaks: GamificationStreakRule[];
  defaultFreezeInventory: number;
  leaderboardsPublic: boolean;
  streakBonuses: GamificationStreakBonus[];
};

export type PrimitiveBadgeCriteria =
  | { type: "xp_total"; minXp: number }
  | { type: "streak_current"; streakKey: string; minCount: number }
  | { type: "event_count"; eventType: string; minCount: number };

export type BadgeCriteria =
  | PrimitiveBadgeCriteria
  | { type: "compound"; operator: "all" | "any"; criteria: PrimitiveBadgeCriteria[] };

export type LeaderboardScopeType = "tenant" | "course" | "group";

export type LeaderboardConfig = {
  scopeType: LeaderboardScopeType;
  courseId?: string;
  spaceId?: string;
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
