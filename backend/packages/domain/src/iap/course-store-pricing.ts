import { z } from "zod";

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

const DEFAULT_PLATFORM: CourseStorePlatformPricing = {
  enabled: false,
  productId: "",
  displayPriceLabel: "",
  priceTierHintCents: null,
};

function parsePlatform(raw: unknown): CourseStorePlatformPricing {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_PLATFORM };
  }
  const record = raw as Record<string, unknown>;
  return courseStorePlatformPricingSchema.parse({
    enabled: record["enabled"] === true,
    productId: typeof record["productId"] === "string" ? record["productId"].trim() : "",
    displayPriceLabel:
      typeof record["displayPriceLabel"] === "string" ? record["displayPriceLabel"].trim() : "",
    priceTierHintCents:
      typeof record["priceTierHintCents"] === "number" &&
      Number.isFinite(record["priceTierHintCents"])
        ? Math.max(0, Math.round(record["priceTierHintCents"]))
        : null,
  });
}

export function parseCourseStorePricing(raw: unknown): CourseStorePricingSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ios: { ...DEFAULT_PLATFORM },
      android: { ...DEFAULT_PLATFORM },
    };
  }
  const record = raw as Record<string, unknown>;
  return courseStorePricingSchema.parse({
    ios: parsePlatform(record["ios"]),
    android: parsePlatform(record["android"]),
  });
}

export function readCourseStorePricingFromMetadata(
  metadataJson: Record<string, unknown> | null | undefined,
): CourseStorePricingSettings {
  const tags =
    metadataJson?.["tags"] &&
    typeof metadataJson["tags"] === "object" &&
    !Array.isArray(metadataJson["tags"])
      ? (metadataJson["tags"] as Record<string, unknown>)
      : undefined;
  return parseCourseStorePricing(tags?.[STORE_PRICING_TAG_KEY]);
}

export function toPublicStorePlatformPricing(settings: CourseStorePlatformPricing) {
  if (!settings.enabled) {
    return {
      enabled: false,
      productId: null,
      displayPriceLabel: null,
      priceTierHintCents: null,
    };
  }

  return {
    enabled: true,
    productId: settings.productId || null,
    displayPriceLabel: settings.displayPriceLabel || null,
    priceTierHintCents: settings.priceTierHintCents,
  };
}
