import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { mergeCourseAccessIntoTags, parseCourseAccessFromTags } from "./course-access-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export const COURSE_NAME_MAX_LENGTH = 60;
export const COURSE_SHORT_DESCRIPTION_MAX_LENGTH = 255;

const BRANDING_TAG_KEY = "studioBranding";

export type CourseBrandingSettings = {
  promoVideoUrl: string;
};

export type CourseBrandingFormState = {
  title: string;
  shortDescription: string;
  description: string;
  coverKey: string;
  promoVideoUrl: string;
};

const DEFAULT_BRANDING: CourseBrandingSettings = {
  promoVideoUrl: "",
};

function parseBrandingFromTags(tags?: Record<string, unknown>): CourseBrandingSettings {
  const raw = tags?.[BRANDING_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_BRANDING;
  }

  const record = raw as Record<string, unknown>;

  return {
    promoVideoUrl:
      typeof record["promoVideoUrl"] === "string" ? record["promoVideoUrl"] : DEFAULT_BRANDING.promoVideoUrl,
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
        promoVideoUrl: branding.promoVideoUrl.trim(),
      },
    },
    access,
  );
}

export function buildCourseBrandingUpdatePayload(
  course: CourseDetail,
  form: CourseBrandingFormState,
  coverKey?: string,
) {
  return {
    title: form.title.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim() || null,
    ...(coverKey !== undefined ? { coverKey: coverKey.length > 0 ? coverKey : undefined } : {}),
    tags: mergeCourseBrandingIntoTags(course.tags, {
      promoVideoUrl: form.promoVideoUrl,
    }),
  };
}
