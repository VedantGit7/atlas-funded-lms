// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

/**
 * Course certificate eligibility — pure helpers for studioFeatures config
 * stored under courses.metadata_json.tags.
 *
 * Passing marks are compared against attempt score_pct (0–100).
 */

export type CertificateAttemptMode = "first_attempt" | "latest_attempt";

export type CertificateTestRef = {
  lessonId: string;
  title: string;
  passingMarks: number;
};

export type CourseCertificateSettings = {
  enabled: boolean;
  templateId: string | null;
  certificateTests: CertificateTestRef[];
  completionCriteriaPercent: number | null;
  attemptMode: CertificateAttemptMode | null;
  validityDays: number | null;
};

export type AttemptScoreSnapshot = {
  assessmentId: string;
  scorePercent: number;
  submittedAt: string | null;
  gradedAt: string | null;
};

const FEATURES_TAG_KEY = "studioFeatures";
const ENABLED_TAG_KEY = "certificate";
const TEMPLATE_TAG_KEY = "certificateTemplateId";
const CONFIG_TAG_KEY = "certificateConfiguration";

const DEFAULT_SETTINGS: CourseCertificateSettings = {
  enabled: false,
  templateId: null,
  certificateTests: [],
  completionCriteriaPercent: null,
  attemptMode: null,
  validityDays: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readConfiguration(
  features: Record<string, unknown> | null,
): Pick<
  CourseCertificateSettings,
  "certificateTests" | "completionCriteriaPercent" | "attemptMode" | "validityDays"
> {
  const raw = asRecord(features?.[CONFIG_TAG_KEY]);
  if (!raw) {
    return {
      certificateTests: DEFAULT_SETTINGS.certificateTests,
      completionCriteriaPercent: DEFAULT_SETTINGS.completionCriteriaPercent,
      attemptMode: DEFAULT_SETTINGS.attemptMode,
      validityDays: DEFAULT_SETTINGS.validityDays,
    };
  }

  const tests = Array.isArray(raw["tests"])
    ? raw["tests"]
        .map((item) => {
          const test = asRecord(item);
          if (!test) return null;
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
    typeof raw["completionCriteriaPercent"] === "number" &&
    raw["completionCriteriaPercent"] >= 0 &&
    raw["completionCriteriaPercent"] <= 100
      ? Math.floor(raw["completionCriteriaPercent"])
      : DEFAULT_SETTINGS.completionCriteriaPercent;

  const attemptMode =
    raw["attemptMode"] === "first_attempt" || raw["attemptMode"] === "latest_attempt"
      ? raw["attemptMode"]
      : DEFAULT_SETTINGS.attemptMode;

  const validityDays =
    typeof raw["validityDays"] === "number" &&
    Number.isInteger(raw["validityDays"]) &&
    raw["validityDays"] > 0
      ? raw["validityDays"]
      : DEFAULT_SETTINGS.validityDays;

  return { certificateTests: tests, completionCriteriaPercent, attemptMode, validityDays };
}

export function parseCourseCertificateSettings(
  tags: Record<string, unknown> | null | undefined,
): CourseCertificateSettings {
  const features = asRecord(tags?.[FEATURES_TAG_KEY]);
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

export function selectAttemptScore(
  attempts: AttemptScoreSnapshot[],
  mode: CertificateAttemptMode,
): AttemptScoreSnapshot | null {
  if (attempts.length === 0) return null;

  const sorted = [...attempts].sort((a, b) => {
    const aTime = Date.parse(a.gradedAt ?? a.submittedAt ?? "") || 0;
    const bTime = Date.parse(b.gradedAt ?? b.submittedAt ?? "") || 0;
    return aTime - bTime;
  });

  if (mode === "first_attempt") {
    return sorted[0] ?? null;
  }

  return sorted[sorted.length - 1] ?? null;
}

export function meetsCompletionCriteria(
  completionPercent: number,
  criteriaPercent: number | null,
): boolean {
  if (criteriaPercent == null) return true;
  return completionPercent >= criteriaPercent;
}

export function meetsTestPassingMarks(scorePercent: number | null, passingMarks: number): boolean {
  if (scorePercent == null) return false;
  return scorePercent >= passingMarks;
}

export type EligibilityInput = {
  settings: CourseCertificateSettings;
  courseStatus: string;
  completionPercent: number;
  /** Map of assessmentId → graded/submitted attempts for that assessment. */
  attemptsByAssessmentId: Map<string, AttemptScoreSnapshot[]>;
  /** Map of lessonId → assessmentId for configured section quizzes. */
  assessmentIdByLessonId: Map<string, string>;
  hasTemplate: boolean;
};

export type EligibilityResult = { eligible: true } | { eligible: false; reason: string };

export function evaluateCourseCertificateEligibility(input: EligibilityInput): EligibilityResult {
  if (!input.settings.enabled) {
    return { eligible: false, reason: "CERTIFICATES_DISABLED" };
  }

  if (input.courseStatus !== "PUBLISHED") {
    return { eligible: false, reason: "COURSE_NOT_PUBLISHED" };
  }

  if (!input.hasTemplate) {
    return { eligible: false, reason: "TEMPLATE_MISSING" };
  }

  if (!meetsCompletionCriteria(input.completionPercent, input.settings.completionCriteriaPercent)) {
    return { eligible: false, reason: "COMPLETION_BELOW_CRITERIA" };
  }

  if (input.settings.certificateTests.length > 0) {
    if (input.settings.attemptMode == null) {
      return { eligible: false, reason: "ATTEMPT_MODE_MISSING" };
    }

    for (const test of input.settings.certificateTests) {
      const assessmentId = input.assessmentIdByLessonId.get(test.lessonId);
      if (!assessmentId) {
        return { eligible: false, reason: `TEST_LESSON_MISSING:${test.lessonId}` };
      }

      const attempts = input.attemptsByAssessmentId.get(assessmentId) ?? [];
      const selected = selectAttemptScore(attempts, input.settings.attemptMode);
      if (!meetsTestPassingMarks(selected?.scorePercent ?? null, test.passingMarks)) {
        return { eligible: false, reason: `TEST_NOT_PASSED:${test.lessonId}` };
      }
    }
  }

  return { eligible: true };
}
