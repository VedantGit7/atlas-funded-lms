import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  mergeCourseAccessIntoTags,
  parseCourseAccessFromTags,
  type CourseAccessMode,
  type CourseAccessSettings,
} from "./course-access-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export type CourseCatalogVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

export type CoursePermissionsSettings = {
  sellIndependently: boolean;
  enrollOnSignup: boolean;
  catalogVisibility: CourseCatalogVisibility;
  accessMode: CourseAccessMode;
  allPlatforms: boolean;
  androidApp: boolean;
  iosApp: boolean;
  inAppSync: boolean;
};

const PERMISSIONS_TAG_KEY = "studioPermissions";
const FEATURES_TAG_KEY = "studioFeatures";

const DEFAULT_SETTINGS: CoursePermissionsSettings = {
  sellIndependently: false,
  enrollOnSignup: false,
  catalogVisibility: "PRIVATE",
  accessMode: "enrollment_required",
  allPlatforms: true,
  androidApp: false,
  iosApp: false,
  inAppSync: false,
};

function isCatalogVisibility(value: unknown): value is CourseCatalogVisibility {
  return value === "PUBLIC" || value === "PRIVATE" || value === "UNLISTED";
}

function readStudioFeature(tags: Record<string, unknown> | undefined, key: string): boolean | null {
  const features = tags?.[FEATURES_TAG_KEY];
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return null;
  }

  const value = (features as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function parseStudioPermissionsRecord(
  tags: Record<string, unknown> | undefined,
): Partial<CoursePermissionsSettings> {
  const raw = tags?.[PERMISSIONS_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const record = raw as Record<string, unknown>;
  const parsed: Partial<CoursePermissionsSettings> = {};

  if (typeof record["sellIndependently"] === "boolean") {
    parsed.sellIndependently = record["sellIndependently"];
  }
  if (typeof record["enrollOnSignup"] === "boolean") {
    parsed.enrollOnSignup = record["enrollOnSignup"];
  }
  if (isCatalogVisibility(record["catalogVisibility"])) {
    parsed.catalogVisibility = record["catalogVisibility"];
  }
  if (typeof record["allPlatforms"] === "boolean") {
    parsed.allPlatforms = record["allPlatforms"];
  }
  if (typeof record["androidApp"] === "boolean") {
    parsed.androidApp = record["androidApp"];
  }
  if (typeof record["iosApp"] === "boolean") {
    parsed.iosApp = record["iosApp"];
  }
  if (typeof record["inAppSync"] === "boolean") {
    parsed.inAppSync = record["inAppSync"];
  }

  return parsed;
}

function inferCatalogVisibility(
  course: CourseDetail,
  accessMode: CourseAccessMode,
): CourseCatalogVisibility {
  const publicCourse = readStudioFeature(course.tags, "publicCourse");
  if (
    publicCourse === true ||
    (publicCourse == null && accessMode === "open" && course.status === "PUBLISHED")
  ) {
    return "PUBLIC";
  }
  return DEFAULT_SETTINGS.catalogVisibility;
}

export function coursePermissionsFromDetail(course: CourseDetail): CoursePermissionsSettings {
  const access = parseCourseAccessFromTags(course.tags);
  const stored = parseStudioPermissionsRecord(course.tags);
  const sellOnlyMobile = readStudioFeature(course.tags, "sellOnlyOnMobile");

  const allPlatforms =
    stored.allPlatforms ??
    (sellOnlyMobile == null ? DEFAULT_SETTINGS.allPlatforms : !sellOnlyMobile);

  return {
    sellIndependently:
      stored.sellIndependently ??
      readStudioFeature(course.tags, "sellIndependently") ??
      course.accessTier === "PAID",
    enrollOnSignup:
      stored.enrollOnSignup ??
      readStudioFeature(course.tags, "enrollOnSignup") ??
      access.accessMode === "open",
    catalogVisibility:
      stored.catalogVisibility ?? inferCatalogVisibility(course, access.accessMode),
    accessMode: access.accessMode,
    allPlatforms,
    androidApp: allPlatforms ? false : (stored.androidApp ?? false),
    iosApp: allPlatforms ? false : (stored.iosApp ?? false),
    inAppSync: stored.inAppSync ?? readStudioFeature(course.tags, "inAppSync") ?? false,
  };
}

export function mergeCoursePermissionsIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CoursePermissionsSettings,
): Record<string, unknown> {
  const existingAccess = parseCourseAccessFromTags(tags);
  const accessSettings: CourseAccessSettings = {
    ...existingAccess,
    accessMode: settings.accessMode,
  };

  const normalizedPlatforms = settings.allPlatforms
    ? { allPlatforms: true, androidApp: false, iosApp: false }
    : {
        allPlatforms: false,
        androidApp: settings.androidApp,
        iosApp: settings.iosApp,
      };

  const permissionsRecord = {
    sellIndependently: settings.sellIndependently,
    enrollOnSignup: settings.enrollOnSignup,
    catalogVisibility: settings.catalogVisibility,
    ...normalizedPlatforms,
    inAppSync: settings.inAppSync,
  };

  const existingFeatures =
    tags?.[FEATURES_TAG_KEY] &&
    typeof tags[FEATURES_TAG_KEY] === "object" &&
    !Array.isArray(tags[FEATURES_TAG_KEY])
      ? (tags[FEATURES_TAG_KEY] as Record<string, unknown>)
      : {};

  const mergedTags = mergeCourseAccessIntoTags(tags, accessSettings);

  return {
    ...mergedTags,
    [PERMISSIONS_TAG_KEY]: permissionsRecord,
    [FEATURES_TAG_KEY]: {
      ...existingFeatures,
      sellIndependently: settings.sellIndependently,
      enrollOnSignup: settings.enrollOnSignup,
      sellOnlyOnMobile:
        !normalizedPlatforms.allPlatforms &&
        (normalizedPlatforms.androidApp || normalizedPlatforms.iosApp),
      publicCourse: settings.catalogVisibility === "PUBLIC",
      inAppSync: settings.inAppSync,
    },
  };
}

export function permissionsSettingsEqual(
  a: CoursePermissionsSettings,
  b: CoursePermissionsSettings,
): boolean {
  return (
    a.sellIndependently === b.sellIndependently &&
    a.enrollOnSignup === b.enrollOnSignup &&
    a.catalogVisibility === b.catalogVisibility &&
    a.accessMode === b.accessMode &&
    a.allPlatforms === b.allPlatforms &&
    a.androidApp === b.androidApp &&
    a.iosApp === b.iosApp &&
    a.inAppSync === b.inAppSync
  );
}
