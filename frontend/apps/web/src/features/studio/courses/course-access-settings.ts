export type CourseAccessMode = "open" | "enrollment_required" | "invite_only";

export type DripReleaseMode = "enrollment_date" | "fixed_start_date";

export type LearningPathLockingMode = "lesson_lock" | "section_lock";

export type DripLessonSchedule = {
  lessonId: string;
  releaseAfterDays: number;
};

export type CourseAccessSettings = {
  accessMode: CourseAccessMode;
  dripEnabled: boolean;
  dripIntervalDays: number;
  dripReleaseMode: DripReleaseMode;
  dripReleaseAt: string | null;
  dripLessonSchedules: DripLessonSchedule[];
  sequentialLearning: boolean;
  lockingMode: LearningPathLockingMode;
  unlockBasedOnScore: boolean;
  unlockScorePercent: number | null;
  prerequisiteCourseIds: string[];
};

export type CourseDripSettings = Pick<
  CourseAccessSettings,
  "dripEnabled" | "dripIntervalDays" | "dripReleaseMode" | "dripReleaseAt" | "dripLessonSchedules"
>;

export type CourseLearningPathSettings = Pick<
  CourseAccessSettings,
  | "sequentialLearning"
  | "lockingMode"
  | "unlockBasedOnScore"
  | "unlockScorePercent"
  | "prerequisiteCourseIds"
>;

const ACCESS_SETTINGS_TAG_KEY = "studioAccess";

const DEFAULT_SETTINGS: CourseAccessSettings = {
  accessMode: "enrollment_required",
  dripEnabled: false,
  dripIntervalDays: 7,
  dripReleaseMode: "enrollment_date",
  dripReleaseAt: null,
  dripLessonSchedules: [],
  sequentialLearning: false,
  lockingMode: "lesson_lock",
  unlockBasedOnScore: false,
  unlockScorePercent: null,
  prerequisiteCourseIds: [],
};

function isAccessMode(value: unknown): value is CourseAccessMode {
  return value === "open" || value === "enrollment_required" || value === "invite_only";
}

function isDripReleaseMode(value: unknown): value is DripReleaseMode {
  return value === "enrollment_date" || value === "fixed_start_date";
}

function isLearningPathLockingMode(value: unknown): value is LearningPathLockingMode {
  return value === "lesson_lock" || value === "section_lock";
}

function readUnlockScorePercent(value: unknown): number | null {
  if (typeof value !== "number" || value < 0 || value > 100) return null;
  return Math.floor(value);
}

function readDripLessonSchedules(value: unknown): DripLessonSchedule[] {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.dripLessonSchedules;

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const lessonId = typeof record["lessonId"] === "string" ? record["lessonId"] : null;
      const releaseAfterDays =
        typeof record["releaseAfterDays"] === "number" && record["releaseAfterDays"] >= 0
          ? Math.floor(record["releaseAfterDays"])
          : null;
      if (!lessonId || releaseAfterDays == null) return null;
      return { lessonId, releaseAfterDays };
    })
    .filter((item): item is DripLessonSchedule => item != null);
}

export function parseCourseAccessFromTags(
  tags?: Record<string, unknown>,
): CourseAccessSettings {
  const raw = tags?.[ACCESS_SETTINGS_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_SETTINGS;
  }

  const record = raw as Record<string, unknown>;

  return {
    accessMode: isAccessMode(record["accessMode"])
      ? record["accessMode"]
      : DEFAULT_SETTINGS.accessMode,
    dripEnabled:
      typeof record["dripEnabled"] === "boolean"
        ? record["dripEnabled"]
        : DEFAULT_SETTINGS.dripEnabled,
    dripIntervalDays:
      typeof record["dripIntervalDays"] === "number" && record["dripIntervalDays"] >= 0
        ? Math.floor(record["dripIntervalDays"])
        : DEFAULT_SETTINGS.dripIntervalDays,
    dripReleaseMode: isDripReleaseMode(record["dripReleaseMode"])
      ? record["dripReleaseMode"]
      : DEFAULT_SETTINGS.dripReleaseMode,
    dripReleaseAt:
      typeof record["dripReleaseAt"] === "string" && record["dripReleaseAt"].length > 0
        ? record["dripReleaseAt"]
        : DEFAULT_SETTINGS.dripReleaseAt,
    dripLessonSchedules: readDripLessonSchedules(record["dripLessonSchedules"]),
    sequentialLearning:
      typeof record["sequentialLearning"] === "boolean"
        ? record["sequentialLearning"]
        : DEFAULT_SETTINGS.sequentialLearning,
    lockingMode: isLearningPathLockingMode(record["lockingMode"])
      ? record["lockingMode"]
      : DEFAULT_SETTINGS.lockingMode,
    unlockBasedOnScore:
      typeof record["unlockBasedOnScore"] === "boolean"
        ? record["unlockBasedOnScore"]
        : DEFAULT_SETTINGS.unlockBasedOnScore,
    unlockScorePercent: readUnlockScorePercent(record["unlockScorePercent"]),
    prerequisiteCourseIds: Array.isArray(record["prerequisiteCourseIds"])
      ? record["prerequisiteCourseIds"].filter((id): id is string => typeof id === "string")
      : DEFAULT_SETTINGS.prerequisiteCourseIds,
  };
}

export function mergeCourseAccessIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseAccessSettings,
): Record<string, unknown> {
  return {
    ...(tags ?? {}),
    [ACCESS_SETTINGS_TAG_KEY]: {
      accessMode: settings.accessMode,
      dripEnabled: settings.dripEnabled,
      dripIntervalDays: settings.dripIntervalDays,
      dripReleaseMode: settings.dripReleaseMode,
      dripReleaseAt: settings.dripReleaseAt,
      dripLessonSchedules: settings.dripLessonSchedules,
      sequentialLearning: settings.sequentialLearning,
      lockingMode: settings.lockingMode,
      unlockBasedOnScore: settings.unlockBasedOnScore,
      unlockScorePercent: settings.unlockScorePercent,
      prerequisiteCourseIds: settings.prerequisiteCourseIds,
    },
  };
}

export function parseCourseDripSettingsFromTags(
  tags?: Record<string, unknown>,
): CourseDripSettings {
  const access = parseCourseAccessFromTags(tags);
  return {
    dripEnabled: access.dripEnabled,
    dripIntervalDays: access.dripIntervalDays,
    dripReleaseMode: access.dripReleaseMode,
    dripReleaseAt: access.dripReleaseAt,
    dripLessonSchedules: access.dripLessonSchedules,
  };
}

export function mergeCourseDripSettingsIntoTags(
  tags: Record<string, unknown> | undefined,
  drip: CourseDripSettings,
): Record<string, unknown> {
  const current = parseCourseAccessFromTags(tags);
  return mergeCourseAccessIntoTags(tags, {
    ...current,
    ...drip,
  });
}

export function courseDripSettingsEqual(a: CourseDripSettings, b: CourseDripSettings): boolean {
  return (
    a.dripEnabled === b.dripEnabled &&
    a.dripIntervalDays === b.dripIntervalDays &&
    a.dripReleaseMode === b.dripReleaseMode &&
    a.dripReleaseAt === b.dripReleaseAt &&
    a.dripLessonSchedules.length === b.dripLessonSchedules.length &&
    a.dripLessonSchedules.every(
      (schedule, index) =>
        schedule.lessonId === b.dripLessonSchedules[index]?.lessonId &&
        schedule.releaseAfterDays === b.dripLessonSchedules[index]?.releaseAfterDays,
    )
  );
}

export function parseCourseLearningPathFromTags(
  tags?: Record<string, unknown>,
): CourseLearningPathSettings {
  const access = parseCourseAccessFromTags(tags);
  return {
    sequentialLearning: access.sequentialLearning,
    lockingMode: access.lockingMode,
    unlockBasedOnScore: access.unlockBasedOnScore,
    unlockScorePercent: access.unlockScorePercent,
    prerequisiteCourseIds: access.prerequisiteCourseIds,
  };
}

export function mergeCourseLearningPathIntoTags(
  tags: Record<string, unknown> | undefined,
  learningPath: CourseLearningPathSettings,
): Record<string, unknown> {
  const current = parseCourseAccessFromTags(tags);
  return mergeCourseAccessIntoTags(tags, {
    ...current,
    ...learningPath,
  });
}

export function courseLearningPathSettingsEqual(
  a: CourseLearningPathSettings,
  b: CourseLearningPathSettings,
): boolean {
  return (
    a.sequentialLearning === b.sequentialLearning &&
    a.lockingMode === b.lockingMode &&
    a.unlockBasedOnScore === b.unlockBasedOnScore &&
    a.unlockScorePercent === b.unlockScorePercent &&
    a.prerequisiteCourseIds.length === b.prerequisiteCourseIds.length &&
    a.prerequisiteCourseIds.every((id, index) => id === b.prerequisiteCourseIds[index])
  );
}
