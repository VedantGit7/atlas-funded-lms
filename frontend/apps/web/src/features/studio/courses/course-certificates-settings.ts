import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export type CertificateAttemptMode = "first_attempt" | "latest_attempt";

export type CertificateTestRef = {
  lessonId: string;
  title: string;
  passingMarks: number;
};

export type CourseCertificatesSettings = {
  enabled: boolean;
  templateId: string | null;
  certificateTests: CertificateTestRef[];
  completionCriteriaPercent: number | null;
  attemptMode: CertificateAttemptMode | null;
};

const FEATURES_TAG_KEY = "studioFeatures";
const ENABLED_TAG_KEY = "certificate";
const TEMPLATE_TAG_KEY = "certificateTemplateId";
const CONFIG_TAG_KEY = "certificateConfiguration";

const DEFAULT_SETTINGS: CourseCertificatesSettings = {
  enabled: false,
  templateId: null,
  certificateTests: [],
  completionCriteriaPercent: null,
  attemptMode: null,
};

function readStudioFeatures(
  tags: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  const features = tags?.[FEATURES_TAG_KEY];
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return null;
  }
  return features as Record<string, unknown>;
}

function readConfiguration(
  features: Record<string, unknown> | null,
): Pick<
  CourseCertificatesSettings,
  "certificateTests" | "completionCriteriaPercent" | "attemptMode"
> {
  const raw = features?.[CONFIG_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      certificateTests: DEFAULT_SETTINGS.certificateTests,
      completionCriteriaPercent: DEFAULT_SETTINGS.completionCriteriaPercent,
      attemptMode: DEFAULT_SETTINGS.attemptMode,
    };
  }

  const record = raw as Record<string, unknown>;
  const tests = Array.isArray(record["tests"])
    ? record["tests"]
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const test = item as Record<string, unknown>;
          const lessonId = typeof test["lessonId"] === "string" ? test["lessonId"] : null;
          const title = typeof test["title"] === "string" ? test["title"] : null;
          const passingMarks =
            typeof test["passingMarks"] === "number" && test["passingMarks"] >= 0
              ? Math.floor(test["passingMarks"])
              : null;
          if (!lessonId || !title || passingMarks == null) return null;
          return { lessonId, title, passingMarks };
        })
        .filter((item): item is CertificateTestRef => item != null)
    : DEFAULT_SETTINGS.certificateTests;

  const completionCriteriaPercent =
    typeof record["completionCriteriaPercent"] === "number" &&
    record["completionCriteriaPercent"] >= 0 &&
    record["completionCriteriaPercent"] <= 100
      ? Math.floor(record["completionCriteriaPercent"])
      : DEFAULT_SETTINGS.completionCriteriaPercent;

  const attemptMode =
    record["attemptMode"] === "first_attempt" || record["attemptMode"] === "latest_attempt"
      ? record["attemptMode"]
      : DEFAULT_SETTINGS.attemptMode;

  return {
    certificateTests: tests,
    completionCriteriaPercent,
    attemptMode,
  };
}

export function courseCertificatesFromDetail(course: CourseDetail): CourseCertificatesSettings {
  const features = readStudioFeatures(course.tags);
  const configuration = readConfiguration(features);
  const enabled =
    typeof features?.[ENABLED_TAG_KEY] === "boolean"
      ? features[ENABLED_TAG_KEY]
      : DEFAULT_SETTINGS.enabled;
  const templateId =
    typeof features?.[TEMPLATE_TAG_KEY] === "string" && features[TEMPLATE_TAG_KEY].length > 0
      ? features[TEMPLATE_TAG_KEY]
      : DEFAULT_SETTINGS.templateId;

  return {
    enabled,
    templateId,
    ...configuration,
  };
}

export function isCertificateConfigurationComplete(settings: CourseCertificatesSettings): boolean {
  return (
    settings.completionCriteriaPercent != null &&
    settings.attemptMode != null &&
    settings.certificateTests.length > 0 &&
    settings.certificateTests.every((test) => test.passingMarks > 0)
  );
}

export function mergeCourseCertificatesIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseCertificatesSettings,
): Record<string, unknown> {
  const existingFeatures = readStudioFeatures(tags) ?? {};

  return {
    ...(tags ?? {}),
    [FEATURES_TAG_KEY]: {
      ...existingFeatures,
      [ENABLED_TAG_KEY]: settings.enabled,
      [TEMPLATE_TAG_KEY]: settings.templateId,
      [CONFIG_TAG_KEY]: {
        tests: settings.certificateTests,
        completionCriteriaPercent: settings.completionCriteriaPercent,
        attemptMode: settings.attemptMode,
      },
    },
  };
}

export function certificatesSettingsEqual(
  a: CourseCertificatesSettings,
  b: CourseCertificatesSettings,
): boolean {
  return (
    a.enabled === b.enabled &&
    a.templateId === b.templateId &&
    a.completionCriteriaPercent === b.completionCriteriaPercent &&
    a.attemptMode === b.attemptMode &&
    a.certificateTests.length === b.certificateTests.length &&
    a.certificateTests.every(
      (test, index) =>
        test.lessonId === b.certificateTests[index]?.lessonId &&
        test.title === b.certificateTests[index].title &&
        test.passingMarks === b.certificateTests[index].passingMarks,
    )
  );
}
