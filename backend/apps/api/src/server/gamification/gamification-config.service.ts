import type { TenantTx } from "@atlas/db";
import { DEFAULT_GAMIFICATION_RULES } from "./gamification-defaults";
import type { GamificationRulesConfig } from "./gamification.types";

type TenantGamificationConfigJson = {
  gamification?: Partial<GamificationRulesConfig>;
};

function mergeRules(
  tenantPartial: Partial<GamificationRulesConfig> | undefined,
): GamificationRulesConfig {
  if (!tenantPartial) {
    return DEFAULT_GAMIFICATION_RULES;
  }

  return {
    xpRules: tenantPartial.xpRules ?? DEFAULT_GAMIFICATION_RULES.xpRules,
    levelThresholds: tenantPartial.levelThresholds ?? DEFAULT_GAMIFICATION_RULES.levelThresholds,
    streaks: tenantPartial.streaks ?? DEFAULT_GAMIFICATION_RULES.streaks,
    defaultFreezeInventory:
      tenantPartial.defaultFreezeInventory ?? DEFAULT_GAMIFICATION_RULES.defaultFreezeInventory,
    leaderboardsPublic:
      tenantPartial.leaderboardsPublic ?? DEFAULT_GAMIFICATION_RULES.leaderboardsPublic,
    streakBonuses: tenantPartial.streakBonuses ?? DEFAULT_GAMIFICATION_RULES.streakBonuses,
  };
}

export function mergeGamificationRules(
  tenantPartial: Partial<GamificationRulesConfig> | undefined,
): GamificationRulesConfig {
  return mergeRules(tenantPartial);
}

export async function readTenantGamificationPartial(
  tx: TenantTx,
): Promise<Partial<GamificationRulesConfig>> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;

  const configJson = rows[0]?.config_json as TenantGamificationConfigJson | undefined;
  return configJson?.gamification ?? {};
}

export async function resolveGamificationRules(tx: TenantTx): Promise<GamificationRulesConfig> {
  const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    limit 1
  `;

  const configJson = rows[0]?.config_json as TenantGamificationConfigJson | undefined;
  return mergeRules(configJson?.gamification);
}

export async function resolveTenantTimezone(tx: TenantTx): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ default_timezone: string }>>`
    select t.default_timezone
    from tenants t
    limit 1
  `;

  return rows[0]?.default_timezone ?? "UTC";
}

export function getTenantLocalDateString(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDaysToDateString(dateString: string, days: number): string {
  const parts = dateString.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function resolvePeriodKey(
  windowKey: "all_time" | "weekly" | "monthly",
  timezone: string,
  date = new Date(),
): string {
  if (windowKey === "all_time") {
    return "all_time";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";

  if (windowKey === "monthly") {
    return `${year}-${month}`;
  }

  const week = getIsoWeekNumber(date, timezone);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export type LeaderboardPeriodRange = {
  /** Tenant-local date (inclusive) the period starts on, formatted YYYY-MM-DD. */
  startDate: string;
  /** Tenant-local date (exclusive) the period ends before, formatted YYYY-MM-DD. */
  endDate: string;
};

export function resolvePeriodRange(
  windowKey: "all_time" | "weekly" | "monthly",
  timezone: string,
  date = new Date(),
): LeaderboardPeriodRange | null {
  if (windowKey === "all_time") {
    return null;
  }

  const localDateString = getTenantLocalDateString(timezone, date);
  const parts = localDateString.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  if (windowKey === "monthly") {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }

  const target = new Date(Date.UTC(year, month - 1, day));
  const dayNum = target.getUTCDay() || 7;
  const start = new Date(target);
  start.setUTCDate(start.getUTCDate() - (dayNum - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function getIsoWeekNumber(date: Date, timezone: string): number {
  const localDateString = getTenantLocalDateString(timezone, date);
  const parts = localDateString.split("-").map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const target = new Date(Date.UTC(year, month - 1, day));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getPreviousWeekPeriodKey(currentWeekKey: string, timezone: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(currentWeekKey);
  if (!match) {
    return currentWeekKey;
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayNum = jan4.getUTCDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - (dayNum - 1) + (week - 1) * 7);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  return resolvePeriodKey("weekly", timezone, weekStart);
}

export function resolveActivityPeriod(
  cadence: "daily" | "weekly",
  timezone: string,
  date = new Date(),
): string {
  if (cadence === "weekly") {
    return resolvePeriodKey("weekly", timezone, date);
  }

  return getTenantLocalDateString(timezone, date);
}

export function getPreviousActivityPeriod(
  cadence: "daily" | "weekly",
  timezone: string,
  currentPeriod: string,
): string {
  if (cadence === "daily") {
    return addDaysToDateString(currentPeriod, -1);
  }

  return getPreviousWeekPeriodKey(currentPeriod, timezone);
}

export function activityDateForPeriod(
  cadence: "daily" | "weekly",
  timezone: string,
  date = new Date(),
): string {
  if (cadence === "daily") {
    return getTenantLocalDateString(timezone, date);
  }

  const range = resolvePeriodRange("weekly", timezone, date);
  return range?.startDate ?? getTenantLocalDateString(timezone, date);
}

export function mergeCourseXpRules(
  tenantRules: GamificationRulesConfig["xpRules"],
  courseRules: GamificationRulesConfig["xpRules"],
): GamificationRulesConfig["xpRules"] {
  if (courseRules.length === 0) {
    return tenantRules;
  }

  const overriddenKeys = new Set(
    courseRules.map((rule) => `${rule.eventType}:${rule.condition ?? ""}`),
  );
  const remaining = tenantRules.filter(
    (rule) => !overriddenKeys.has(`${rule.eventType}:${rule.condition ?? ""}`),
  );
  return [...remaining, ...courseRules];
}

export function calculateLevelKey(
  xpTotal: number,
  thresholds: GamificationRulesConfig["levelThresholds"],
): string {
  let levelKey = thresholds[0]?.levelKey ?? "level_1";

  for (const threshold of thresholds) {
    if (xpTotal >= threshold.minXp) {
      levelKey = threshold.levelKey;
    }
  }

  return levelKey;
}

export function buildXpIdempotencyKey(outboxEventId: string, ruleKey: string): string {
  return `xp:${outboxEventId}:${ruleKey}`;
}

export function selectXpRulesForEvent(
  rules: GamificationRulesConfig,
  eventType: string,
  options?: { passed: boolean },
) {
  return rules.xpRules.filter((rule) => {
    if (rule.eventType !== eventType) {
      return false;
    }

    if (rule.condition === "pass") {
      return options?.passed === true;
    }

    return !rule.condition;
  });
}

export function selectStreakRulesForEvent(rules: GamificationRulesConfig, eventType: string) {
  return rules.streaks.filter((rule) => rule.eventTypes.includes(eventType));
}
