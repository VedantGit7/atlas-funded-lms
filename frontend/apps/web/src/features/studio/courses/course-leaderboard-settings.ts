import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export type CourseLeaderboardSettings = {
  quizLeaderboard: boolean;
  assignmentLeaderboard: boolean;
};

const FEATURES_TAG_KEY = "studioFeatures";
const SETTINGS_TAG_KEY = "leaderboard";

const DEFAULT_SETTINGS: CourseLeaderboardSettings = {
  quizLeaderboard: false,
  assignmentLeaderboard: false,
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
  if (typeof value === "boolean") {
    return {
      quizLeaderboard: value,
      assignmentLeaderboard: value,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function courseLeaderboardFromTags(
  tags: Record<string, unknown> | undefined,
): CourseLeaderboardSettings {
  const stored = readStudioFeatureObject(tags, SETTINGS_TAG_KEY);

  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    quizLeaderboard: readBoolean(stored["quizLeaderboard"], DEFAULT_SETTINGS.quizLeaderboard),
    assignmentLeaderboard: readBoolean(
      stored["assignmentLeaderboard"],
      DEFAULT_SETTINGS.assignmentLeaderboard,
    ),
  };
}

export function courseLeaderboardFromDetail(course: CourseDetail): CourseLeaderboardSettings {
  return courseLeaderboardFromTags(course.tags);
}

export function isCourseLeaderboardEnabled(settings: CourseLeaderboardSettings): boolean {
  return settings.quizLeaderboard || settings.assignmentLeaderboard;
}

export function mergeCourseLeaderboardIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseLeaderboardSettings,
): Record<string, unknown> {
  const existingFeatures =
    tags?.[FEATURES_TAG_KEY] &&
    typeof tags[FEATURES_TAG_KEY] === "object" &&
    !Array.isArray(tags[FEATURES_TAG_KEY])
      ? (tags[FEATURES_TAG_KEY] as Record<string, unknown>)
      : {};

  return {
    ...(tags ?? {}),
    [FEATURES_TAG_KEY]: {
      ...existingFeatures,
      [SETTINGS_TAG_KEY]: {
        quizLeaderboard: settings.quizLeaderboard,
        assignmentLeaderboard: settings.assignmentLeaderboard,
      },
    },
  };
}

export function leaderboardSettingsEqual(
  a: CourseLeaderboardSettings,
  b: CourseLeaderboardSettings,
): boolean {
  return (
    a.quizLeaderboard === b.quizLeaderboard && a.assignmentLeaderboard === b.assignmentLeaderboard
  );
}
