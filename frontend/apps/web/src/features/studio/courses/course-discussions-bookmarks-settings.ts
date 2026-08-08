import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export type CourseDiscussionsBookmarksSettings = {
  discussions: boolean;
  privateDiscussions: boolean;
  bookmarks: boolean;
};

const FEATURES_TAG_KEY = "studioFeatures";
const SETTINGS_TAG_KEY = "discussionsBookmarks";

const DEFAULT_SETTINGS: CourseDiscussionsBookmarksSettings = {
  discussions: false,
  privateDiscussions: false,
  bookmarks: false,
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

export function courseDiscussionsBookmarksFromDetail(
  course: CourseDetail,
): CourseDiscussionsBookmarksSettings {
  const stored = readStudioFeatureObject(course.tags, SETTINGS_TAG_KEY);

  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    discussions: readBoolean(stored["discussions"], DEFAULT_SETTINGS.discussions),
    privateDiscussions: readBoolean(
      stored["privateDiscussions"],
      DEFAULT_SETTINGS.privateDiscussions,
    ),
    bookmarks: readBoolean(stored["bookmarks"], DEFAULT_SETTINGS.bookmarks),
  };
}

export function mergeCourseDiscussionsBookmarksIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseDiscussionsBookmarksSettings,
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
        discussions: settings.discussions,
        privateDiscussions: settings.privateDiscussions,
        bookmarks: settings.bookmarks,
      },
    },
  };
}

export function discussionsBookmarksSettingsEqual(
  a: CourseDiscussionsBookmarksSettings,
  b: CourseDiscussionsBookmarksSettings,
): boolean {
  return (
    a.discussions === b.discussions &&
    a.privateDiscussions === b.privateDiscussions &&
    a.bookmarks === b.bookmarks
  );
}
