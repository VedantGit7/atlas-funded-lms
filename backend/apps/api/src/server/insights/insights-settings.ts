import type { InsightDashboardRange } from "./insights-range";

export const INSIGHT_SETTINGS_REFRESH_MINUTES = [15, 30, 60] as const;
export const INSIGHT_SETTINGS_CACHE_MINUTES = [5, 15, 30, 60] as const;

export type InsightWeekStart = "monday" | "sunday";
export type InsightNumberFormat = "international" | "european";
export type InsightDataClass = "personal" | "aggregated" | "financial";

export type InsightSettingsActivity = {
  at: string;
  action: string;
  actorLabel: string;
};

export type InsightSettings = {
  defaultSection: string;
  defaultPeriod: InsightDashboardRange;
  weekStartsOn: InsightWeekStart;
  numberFormat: InsightNumberFormat;
  autoRefresh: boolean;
  refreshIntervalMinutes: (typeof INSIGHT_SETTINGS_REFRESH_MINUTES)[number];
  showLastUpdated: boolean;
  cacheMinutes: (typeof INSIGHT_SETTINGS_CACHE_MINUTES)[number];
  restrictedSlugs: string[];
  activity: InsightSettingsActivity[];
};

const SECTION_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "school-vitals": "School Vitals",
  "sales-insight": "Sales Insight",
  "live-dashboard": "Live Dashboard",
  "marketing-insight": "Marketing Insight",
  "messenger-insight": "Messenger Insight",
};

const DATA_CLASS: Record<string, InsightDataClass> = {
  dashboard: "personal",
  "school-vitals": "aggregated",
  "sales-insight": "financial",
  "live-dashboard": "personal",
  "marketing-insight": "aggregated",
  "messenger-insight": "personal",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function insightSectionSlugs(): string[] {
  return Object.keys(SECTION_TITLES);
}

export function insightSectionTitle(slug: string): string {
  return SECTION_TITLES[slug] ?? slug;
}

export function insightDataClass(slug: string): InsightDataClass {
  return DATA_CLASS[slug] ?? "aggregated";
}

export function defaultInsightSettings(): InsightSettings {
  return {
    defaultSection: "dashboard",
    defaultPeriod: "30d",
    weekStartsOn: "monday",
    numberFormat: "international",
    autoRefresh: false,
    refreshIntervalMinutes: 15,
    showLastUpdated: true,
    cacheMinutes: 30,
    restrictedSlugs: [],
    activity: [],
  };
}

export function isInsightSectionSlug(value: string): boolean {
  return Boolean(SECTION_TITLES[value]);
}

export function parseInsightSettings(value: unknown): InsightSettings {
  const defaults = defaultInsightSettings();
  const record = asRecord(value);
  if (!record) return defaults;
  const period = record["defaultPeriod"];
  const week = record["weekStartsOn"];
  const format = record["numberFormat"];
  const refresh = record["refreshIntervalMinutes"];
  const cache = record["cacheMinutes"];
  const defaultSection = asString(record["defaultSection"], defaults.defaultSection);
  const restrictedRaw = record["restrictedSlugs"];
  const restrictedSlugs = Array.isArray(restrictedRaw)
    ? restrictedRaw.filter(
        (item): item is string => typeof item === "string" && isInsightSectionSlug(item),
      )
    : [];
  const activityRaw = record["activity"];
  const activity: InsightSettingsActivity[] = [];
  if (Array.isArray(activityRaw)) {
    for (const row of activityRaw) {
      const entry = asRecord(row);
      if (!entry) continue;
      const action = asString(entry["action"]).trim();
      if (!action) continue;
      activity.push({
        at: asString(entry["at"], new Date().toISOString()),
        action,
        actorLabel: asString(entry["actorLabel"], "Operator"),
      });
    }
  }
  return {
    defaultSection: isInsightSectionSlug(defaultSection) ? defaultSection : defaults.defaultSection,
    defaultPeriod: period === "12m" || period === "ytd" ? period : "30d",
    weekStartsOn: week === "sunday" ? "sunday" : "monday",
    numberFormat: format === "european" ? "european" : "international",
    autoRefresh: record["autoRefresh"] === true,
    refreshIntervalMinutes: INSIGHT_SETTINGS_REFRESH_MINUTES.includes(
      refresh as (typeof INSIGHT_SETTINGS_REFRESH_MINUTES)[number],
    )
      ? (refresh as (typeof INSIGHT_SETTINGS_REFRESH_MINUTES)[number])
      : defaults.refreshIntervalMinutes,
    showLastUpdated: record["showLastUpdated"] !== false,
    cacheMinutes: INSIGHT_SETTINGS_CACHE_MINUTES.includes(
      cache as (typeof INSIGHT_SETTINGS_CACHE_MINUTES)[number],
    )
      ? (cache as (typeof INSIGHT_SETTINGS_CACHE_MINUTES)[number])
      : defaults.cacheMinutes,
    restrictedSlugs,
    activity: activity.slice(0, 20),
  };
}

export function numberFormatSample(format: InsightNumberFormat): string {
  return format === "european" ? "1.234.567,89" : "1,234,567.89";
}

export function settingsEqual(left: InsightSettings, right: InsightSettings): boolean {
  return (
    left.defaultSection === right.defaultSection &&
    left.defaultPeriod === right.defaultPeriod &&
    left.weekStartsOn === right.weekStartsOn &&
    left.numberFormat === right.numberFormat &&
    left.autoRefresh === right.autoRefresh &&
    left.refreshIntervalMinutes === right.refreshIntervalMinutes &&
    left.showLastUpdated === right.showLastUpdated &&
    left.cacheMinutes === right.cacheMinutes &&
    left.restrictedSlugs.slice().sort().join(",") === right.restrictedSlugs.slice().sort().join(",")
  );
}

export type InsightSettingsPatch = {
  defaultSection: string;
  defaultPeriod: InsightDashboardRange;
  weekStartsOn: InsightWeekStart;
  numberFormat: InsightNumberFormat;
  autoRefresh: boolean;
  refreshIntervalMinutes: (typeof INSIGHT_SETTINGS_REFRESH_MINUTES)[number];
  showLastUpdated: boolean;
  cacheMinutes: (typeof INSIGHT_SETTINGS_CACHE_MINUTES)[number];
};

function appendActivity(
  settings: InsightSettings,
  action: string,
  actorLabel: string,
  at = new Date(),
): InsightSettings {
  return {
    ...settings,
    activity: [{ at: at.toISOString(), action, actorLabel }, ...settings.activity].slice(0, 20),
  };
}

export function applyInsightSettingsMutation(
  settings: InsightSettings,
  action:
    | { type: "save"; patch: InsightSettingsPatch; actorLabel: string }
    | { type: "restrict"; slug: string; actorLabel: string }
    | { type: "unrestrict"; slug: string; actorLabel: string },
): InsightSettings {
  if (action.type === "save") {
    const patch = action.patch;
    const defaultSection = isInsightSectionSlug(patch.defaultSection)
      ? patch.defaultSection
      : settings.defaultSection;
    const next: InsightSettings = {
      ...settings,
      defaultSection,
      defaultPeriod: patch.defaultPeriod,
      weekStartsOn: patch.weekStartsOn,
      numberFormat: patch.numberFormat,
      autoRefresh: patch.autoRefresh,
      refreshIntervalMinutes: patch.refreshIntervalMinutes,
      showLastUpdated: patch.showLastUpdated,
      cacheMinutes: patch.cacheMinutes,
    };
    if (settingsEqual(settings, next)) return settings;
    return appendActivity(next, "Insights defaults updated", action.actorLabel);
  }
  if (!isInsightSectionSlug(action.slug)) return settings;
  if (action.type === "restrict") {
    if (settings.restrictedSlugs.includes(action.slug)) return settings;
    const unrestricted = insightSectionSlugs().filter(
      (slug) => slug !== action.slug && !settings.restrictedSlugs.includes(slug),
    );
    if (unrestricted.length === 0) return settings;
    const restrictedSlugs = [...settings.restrictedSlugs, action.slug];
    const defaultSection = restrictedSlugs.includes(settings.defaultSection)
      ? (unrestricted[0] ?? "dashboard")
      : settings.defaultSection;
    return appendActivity(
      { ...settings, restrictedSlugs, defaultSection },
      `Section restricted ${action.slug}`,
      action.actorLabel,
    );
  }
  return appendActivity(
    {
      ...settings,
      restrictedSlugs: settings.restrictedSlugs.filter((slug) => slug !== action.slug),
    },
    `Section restored ${action.slug}`,
    action.actorLabel,
  );
}

export function describeLayoutReset(
  slug: string,
  actorLabel: string,
  settings: InsightSettings,
): InsightSettings {
  return appendActivity(settings, `Layout reset ${slug}`, actorLabel);
}
