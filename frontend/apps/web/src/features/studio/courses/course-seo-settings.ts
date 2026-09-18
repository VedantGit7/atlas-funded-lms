import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { mergeCourseAccessIntoTags, parseCourseAccessFromTags } from "./course-access-settings";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export const COURSE_FRIENDLY_URL_MAX_LENGTH = 100;
export const COURSE_PAGE_TITLE_MAX_LENGTH = 60;
export const COURSE_SEO_DESCRIPTION_MAX_LENGTH = 5000;

const SEO_TAG_KEY = "studioSeo";
const BRANDING_TAG_KEY = "studioBranding";

export type CourseSeoSettings = {
  pageTitle: string;
  seoDescription: string;
};

export type CourseSeoFormState = {
  slug: string;
  pageTitle: string;
  seoDescription: string;
};

const DEFAULT_SEO: CourseSeoSettings = {
  pageTitle: "",
  seoDescription: "",
};

function parseSeoFromTags(tags?: Record<string, unknown>): CourseSeoSettings {
  const raw = tags?.[SEO_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_SEO;
  }

  const record = raw as Record<string, unknown>;

  return {
    pageTitle:
      typeof record["pageTitle"] === "string" ? record["pageTitle"] : DEFAULT_SEO.pageTitle,
    seoDescription:
      typeof record["seoDescription"] === "string"
        ? record["seoDescription"]
        : DEFAULT_SEO.seoDescription,
  };
}

function readBrandingPromoVideo(tags?: Record<string, unknown>): string {
  const raw = tags?.[BRANDING_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "";
  }
  const record = raw as Record<string, unknown>;
  return typeof record["promoVideoUrl"] === "string" ? record["promoVideoUrl"] : "";
}

export function normalizeCourseSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, COURSE_FRIENDLY_URL_MAX_LENGTH);
}

export function courseSeoFromDetail(course: CourseDetail): CourseSeoFormState {
  const seo = parseSeoFromTags(course.tags);

  return {
    slug: course.slug,
    pageTitle: seo.pageTitle,
    seoDescription: seo.seoDescription,
  };
}

export function mergeCourseSeoIntoTags(
  tags: Record<string, unknown> | undefined,
  seo: CourseSeoSettings,
): Record<string, unknown> {
  const access = parseCourseAccessFromTags(tags);

  return mergeCourseAccessIntoTags(
    {
      ...(tags ?? {}),
      [SEO_TAG_KEY]: {
        pageTitle: seo.pageTitle.trim(),
        seoDescription: seo.seoDescription.trim(),
      },
      [BRANDING_TAG_KEY]: {
        promoVideoUrl: readBrandingPromoVideo(tags),
      },
    },
    access,
  );
}

export function buildCourseSeoUpdatePayload(course: CourseDetail, form: CourseSeoFormState) {
  const slug = normalizeCourseSlug(form.slug);

  return {
    slug,
    tags: mergeCourseSeoIntoTags(course.tags, {
      pageTitle: form.pageTitle,
      seoDescription: form.seoDescription,
    }),
  };
}

export function resolveCourseLearnerUrlBase(): string {
  if (typeof window === "undefined") {
    return "/courses/";
  }
  return `${window.location.origin}/courses/`;
}
