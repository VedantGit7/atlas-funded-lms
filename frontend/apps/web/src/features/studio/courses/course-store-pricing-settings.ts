import { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

export const STORE_PRICING_TAG_KEY = "studioStorePricing";

export const courseStorePlatformPricingSchema = z
  .object({
    enabled: z.boolean(),
    productId: z.string().trim().max(200),
    displayPriceLabel: z.string().trim().max(80),
    priceTierHintCents: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const courseStorePricingSchema = z
  .object({
    ios: courseStorePlatformPricingSchema,
    android: courseStorePlatformPricingSchema,
  })
  .strict();

export type CourseStorePlatformPricing = z.infer<typeof courseStorePlatformPricingSchema>;
export type CourseStorePricingSettings = z.infer<typeof courseStorePricingSchema>;
export type CourseStorePricingPlatform = "ios" | "android";

export const DEFAULT_STORE_PLATFORM_PRICING: CourseStorePlatformPricing = {
  enabled: false,
  productId: "",
  displayPriceLabel: "",
  priceTierHintCents: null,
};

export const DEFAULT_STORE_PRICING: CourseStorePricingSettings = {
  ios: { ...DEFAULT_STORE_PLATFORM_PRICING },
  android: { ...DEFAULT_STORE_PLATFORM_PRICING },
};

function parsePlatformPricing(raw: unknown): CourseStorePlatformPricing {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_STORE_PLATFORM_PRICING };
  }

  const record = raw as Record<string, unknown>;
  const productId = typeof record["productId"] === "string" ? record["productId"].trim() : "";
  const displayPriceLabel =
    typeof record["displayPriceLabel"] === "string" ? record["displayPriceLabel"].trim() : "";
  const priceTierHintCents =
    typeof record["priceTierHintCents"] === "number" &&
    Number.isFinite(record["priceTierHintCents"])
      ? Math.max(0, Math.round(record["priceTierHintCents"]))
      : null;

  return courseStorePlatformPricingSchema.parse({
    enabled: record["enabled"] === true,
    productId,
    displayPriceLabel,
    priceTierHintCents,
  });
}

export function parseCourseStorePricing(raw: unknown): CourseStorePricingSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ios: { ...DEFAULT_STORE_PLATFORM_PRICING },
      android: { ...DEFAULT_STORE_PLATFORM_PRICING },
    };
  }

  const record = raw as Record<string, unknown>;
  return courseStorePricingSchema.parse({
    ios: parsePlatformPricing(record["ios"]),
    android: parsePlatformPricing(record["android"]),
  });
}

export function serializeCourseStorePricing(
  settings: CourseStorePricingSettings,
): CourseStorePricingSettings {
  return courseStorePricingSchema.parse({
    ios: {
      enabled: settings.ios.enabled,
      productId: settings.ios.productId.trim(),
      displayPriceLabel: settings.ios.displayPriceLabel.trim(),
      priceTierHintCents: settings.ios.priceTierHintCents,
    },
    android: {
      enabled: settings.android.enabled,
      productId: settings.android.productId.trim(),
      displayPriceLabel: settings.android.displayPriceLabel.trim(),
      priceTierHintCents: settings.android.priceTierHintCents,
    },
  });
}

export function courseStorePricingFromDetail(course: CourseDetail): CourseStorePricingSettings {
  return parseCourseStorePricing(course.tags?.[STORE_PRICING_TAG_KEY]);
}

export function courseStorePlatformPricingFromDetail(
  course: CourseDetail,
  platform: CourseStorePricingPlatform,
): CourseStorePlatformPricing {
  return courseStorePricingFromDetail(course)[platform];
}

export function mergeCourseStorePricingIntoTags(
  tags: Record<string, unknown> | undefined,
  settings: CourseStorePricingSettings,
): Record<string, unknown> {
  return {
    ...(tags ?? {}),
    [STORE_PRICING_TAG_KEY]: serializeCourseStorePricing(settings),
  };
}

export function mergeCourseStorePlatformPricingIntoTags(
  tags: Record<string, unknown> | undefined,
  platform: CourseStorePricingPlatform,
  platformSettings: CourseStorePlatformPricing,
): Record<string, unknown> {
  const current = parseCourseStorePricing(tags?.[STORE_PRICING_TAG_KEY]);
  return mergeCourseStorePricingIntoTags(tags, {
    ...current,
    [platform]: platformSettings,
  });
}

export function storePlatformPricingEqual(
  a: CourseStorePlatformPricing,
  b: CourseStorePlatformPricing,
): boolean {
  return (
    a.enabled === b.enabled &&
    a.productId === b.productId &&
    a.displayPriceLabel === b.displayPriceLabel &&
    a.priceTierHintCents === b.priceTierHintCents
  );
}
