import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export type CourseRatingsReviewsSettings = {
  enabled: boolean;
};

const FEATURES_TAG_KEY = "studioFeatures";
const SETTINGS_TAG_KEY = "ratingsReviews";

const DEFAULT_SETTINGS: CourseRatingsReviewsSettings = {
  enabled: false,
};

function readStudioFeature(tags: Record<string, unknown> | undefined, key: string): boolean | null {
  const features = tags?.[FEATURES_TAG_KEY];
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return null;
  }

  const value = (features as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

export function courseRatingsReviewsFromDetail(course: CourseDetail): CourseRatingsReviewsSettings {
  const stored = readStudioFeature(course.tags, SETTINGS_TAG_KEY);
  return {
    enabled: stored ?? DEFAULT_SETTINGS.enabled,
  };
}

export function mergeCourseRatingsReviewsIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseRatingsReviewsSettings,
): Record<string, unknown> {
  const existingFeatures =
    tags?.[FEATURES_TAG_KEY] && typeof tags[FEATURES_TAG_KEY] === "object" && !Array.isArray(tags[FEATURES_TAG_KEY])
      ? (tags[FEATURES_TAG_KEY] as Record<string, unknown>)
      : {};

  return {
    ...(tags ?? {}),
    [FEATURES_TAG_KEY]: {
      ...existingFeatures,
      [SETTINGS_TAG_KEY]: settings.enabled,
    },
  };
}

export function ratingsReviewsSettingsEqual(
  a: CourseRatingsReviewsSettings,
  b: CourseRatingsReviewsSettings,
): boolean {
  return a.enabled === b.enabled;
}
