import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export type CourseLearnerConfigurationsSettings = {
  requestCompleteGstinAddress: boolean;
  requestDateOfBirth: boolean;
  requestPan: boolean;
  enableInvoices: boolean;
  showBillingDetails: boolean;
  allowInvoiceDownload: boolean;
};

const FEATURES_TAG_KEY = "studioFeatures";
const SETTINGS_TAG_KEY = "learnerConfigurations";

const DEFAULT_SETTINGS: CourseLearnerConfigurationsSettings = {
  requestCompleteGstinAddress: false,
  requestDateOfBirth: false,
  requestPan: false,
  enableInvoices: false,
  showBillingDetails: false,
  allowInvoiceDownload: false,
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

export function courseLearnerConfigurationsFromDetail(
  course: CourseDetail,
): CourseLearnerConfigurationsSettings {
  const stored = readStudioFeatureObject(course.tags, SETTINGS_TAG_KEY);

  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    requestCompleteGstinAddress: readBoolean(
      stored["requestCompleteGstinAddress"],
      DEFAULT_SETTINGS.requestCompleteGstinAddress,
    ),
    requestDateOfBirth: readBoolean(
      stored["requestDateOfBirth"],
      DEFAULT_SETTINGS.requestDateOfBirth,
    ),
    requestPan: readBoolean(stored["requestPan"], DEFAULT_SETTINGS.requestPan),
    enableInvoices: readBoolean(stored["enableInvoices"], DEFAULT_SETTINGS.enableInvoices),
    showBillingDetails: readBoolean(
      stored["showBillingDetails"],
      DEFAULT_SETTINGS.showBillingDetails,
    ),
    allowInvoiceDownload: readBoolean(
      stored["allowInvoiceDownload"],
      DEFAULT_SETTINGS.allowInvoiceDownload,
    ),
  };
}

export function mergeCourseLearnerConfigurationsIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseLearnerConfigurationsSettings,
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
        requestCompleteGstinAddress: settings.requestCompleteGstinAddress,
        requestDateOfBirth: settings.requestDateOfBirth,
        requestPan: settings.requestPan,
        enableInvoices: settings.enableInvoices,
        showBillingDetails: settings.showBillingDetails,
        allowInvoiceDownload: settings.allowInvoiceDownload,
      },
    },
  };
}

export function learnerConfigurationsSettingsEqual(
  a: CourseLearnerConfigurationsSettings,
  b: CourseLearnerConfigurationsSettings,
): boolean {
  return (
    a.requestCompleteGstinAddress === b.requestCompleteGstinAddress &&
    a.requestDateOfBirth === b.requestDateOfBirth &&
    a.requestPan === b.requestPan &&
    a.enableInvoices === b.enableInvoices &&
    a.showBillingDetails === b.showBillingDetails &&
    a.allowInvoiceDownload === b.allowInvoiceDownload
  );
}
