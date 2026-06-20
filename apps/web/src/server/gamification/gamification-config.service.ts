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
  };
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
