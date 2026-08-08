import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export type CourseXpRuleOverride = {
  eventType: string;
  points: number;
  condition?: "pass" | undefined;
};

export type CourseGamificationSettings = {
  enabled: boolean;
  xpRuleOverrides: CourseXpRuleOverride[];
};

const FEATURES_TAG_KEY = "studioFeatures";
const SETTINGS_TAG_KEY = "gamification";

const DEFAULT_SETTINGS: CourseGamificationSettings = {
  enabled: false,
  xpRuleOverrides: [],
};

function readStudioFeatureObject(
  tags: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | null {
  const features = tags?.[FEATURES_TAG_KEY];
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return null;
  }

  const value = (features as Record<string, unknown>)[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readXpRuleOverrides(value: unknown): CourseXpRuleOverride[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const eventType = record["eventType"];
    const points = record["points"];
    if (typeof eventType !== "string" || typeof points !== "number") return [];
    const condition = record["condition"];
    return [
      {
        eventType,
        points,
        ...(condition === "pass" ? { condition: "pass" as const } : {}),
      },
    ];
  });
}

export function courseGamificationFromTags(
  tags: Record<string, unknown> | undefined,
): CourseGamificationSettings {
  const stored = readStudioFeatureObject(tags, SETTINGS_TAG_KEY);
  if (!stored) return { ...DEFAULT_SETTINGS };

  return {
    enabled: readBoolean(stored["enabled"], DEFAULT_SETTINGS.enabled),
    xpRuleOverrides: readXpRuleOverrides(stored["xpRuleOverrides"]),
  };
}

export function courseGamificationFromDetail(course: CourseDetail): CourseGamificationSettings {
  return courseGamificationFromTags(course.tags);
}

export function mergeCourseGamificationIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseGamificationSettings,
): Record<string, unknown> {
  const existingFeatures =
    tags?.[FEATURES_TAG_KEY] && typeof tags[FEATURES_TAG_KEY] === "object" && !Array.isArray(tags[FEATURES_TAG_KEY])
      ? (tags[FEATURES_TAG_KEY] as Record<string, unknown>)
      : {};

  return {
    ...(tags ?? {}),
    [FEATURES_TAG_KEY]: {
      ...existingFeatures,
      [SETTINGS_TAG_KEY]: {
        enabled: settings.enabled,
        xpRuleOverrides: settings.xpRuleOverrides.map((rule) => ({
          eventType: rule.eventType,
          points: rule.points,
          ...(rule.condition ? { condition: rule.condition } : {}),
        })),
      },
    },
  };
}

export function gamificationSettingsEqual(
  a: CourseGamificationSettings,
  b: CourseGamificationSettings,
): boolean {
  if (a.enabled !== b.enabled) return false;
  if (a.xpRuleOverrides.length !== b.xpRuleOverrides.length) return false;

  return a.xpRuleOverrides.every((rule, index) => {
    const other = b.xpRuleOverrides[index];
    if (!other) return false;
    return (
      rule.eventType === other.eventType &&
      rule.points === other.points &&
      rule.condition === other.condition
    );
  });
}
