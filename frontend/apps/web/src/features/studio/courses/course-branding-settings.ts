import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { mergeCourseAccessIntoTags, parseCourseAccessFromTags } from "./course-access-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export const COURSE_NAME_MAX_LENGTH = 60;
export const COURSE_SHORT_DESCRIPTION_MAX_LENGTH = 255;
/** "What you'll learn" on the course page (QA review 1 M38); the API keeps the same limits. */
export const COURSE_OUTCOMES_MAX = 12;
export const COURSE_OUTCOME_MAX_LENGTH = 200;

const BRANDING_TAG_KEY = "studioBranding";

export type CourseBrandingSettings = {
  promoVideoUrl: string;
  outcomes: string[];
};

export type CourseBrandingFormState = {
  title: string;
  shortDescription: string;
  description: string;
  coverKey: string;
  promoVideoUrl: string;
  /** One point per line. */
  outcomesText: string;
};

const DEFAULT_BRANDING: CourseBrandingSettings = {
  promoVideoUrl: "",
  outcomes: [],
};

function brandingRecord(tags?: Record<string, unknown>): Record<string, unknown> {
  const raw = tags?.[BRANDING_TAG_KEY];
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function parseBrandingFromTags(tags?: Record<string, unknown>): CourseBrandingSettings {
  const raw = tags?.[BRANDING_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_BRANDING;
  }

  const record = raw as Record<string, unknown>;

  return {
    promoVideoUrl:
      typeof record["promoVideoUrl"] === "string"
        ? record["promoVideoUrl"]
        : DEFAULT_BRANDING.promoVideoUrl,
    outcomes: Array.isArray(record["outcomes"])
      ? record["outcomes"].filter((item): item is string => typeof item === "string")
      : DEFAULT_BRANDING.outcomes,
  };
}

export function courseBrandingFromDetail(course: CourseDetail): CourseBrandingFormState {
  const branding = parseBrandingFromTags(course.tags);

  return {
    title: course.title,
    shortDescription: course.shortDescription?.trim() ?? "",
    description: course.description?.trim() ?? "",
    coverKey: course.coverKey?.trim() ?? "",
    promoVideoUrl: branding.promoVideoUrl,
    outcomesText: branding.outcomes.join("\n"),
  };
}

export function mergeCourseBrandingIntoTags(
  tags: Record<string, unknown> | undefined,
  branding: CourseBrandingSettings,
): Record<string, unknown> {
  const access = parseCourseAccessFromTags(tags);

  return mergeCourseAccessIntoTags(
    {
      ...(tags ?? {}),
      [BRANDING_TAG_KEY]: {
        ...brandingRecord(tags),
        promoVideoUrl: branding.promoVideoUrl.trim(),
        outcomes: branding.outcomes,
      },
    },
    access,
  );
}

/** The points learners will see, one per non-empty line, trimmed and capped. */
export function parseCourseOutcomes(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, COURSE_OUTCOME_MAX_LENGTH))
    .slice(0, COURSE_OUTCOMES_MAX);
}

/** Problems that stop a save, in the order the fields appear. */
export function courseBrandingProblem(form: CourseBrandingFormState): string | null {
  if (!form.title.trim()) return "Course name is required.";
  const lines = form.outcomesText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length > COURSE_OUTCOMES_MAX) {
    return `"What you'll learn" holds up to ${String(COURSE_OUTCOMES_MAX)} points. Remove ${String(lines.length - COURSE_OUTCOMES_MAX)}.`;
  }
  const promo = form.promoVideoUrl.trim();
  if (
    promo &&
    !/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\//i.test(
      promo,
    )
  ) {
    return "Use a YouTube or Vimeo link for the course video.";
  }
  return null;
}

/**
 * The text fields and settings. The image is uploaded and set separately; a
 * removed image is sent as null so the course really loses it.
 */
export function buildCourseBrandingUpdatePayload(
  course: CourseDetail,
  form: CourseBrandingFormState,
) {
  const removeCover = Boolean(course.coverKey?.trim()) && form.coverKey.trim() === "";
  return {
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim() || null,
    ...(removeCover ? { coverKey: null } : {}),
    tags: mergeCourseBrandingIntoTags(course.tags, {
      promoVideoUrl: form.promoVideoUrl,
      outcomes: parseCourseOutcomes(form.outcomesText),
    }),
  };
}
