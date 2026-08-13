import { describe, expect, it } from "vitest";
import {
  parseCourseStorePricing,
  serializeCourseStorePricing,
  STORE_PRICING_TAG_KEY,
} from "../../../frontend/apps/web/src/features/studio/courses/course-store-pricing-settings";
import {
  parseCourseStorePricing as parseDomainStorePricing,
  readCourseStorePricingFromMetadata,
  toPublicStorePlatformPricing,
} from "@atlas/domain/iap/course-store-pricing";

describe("course store pricing parse/serialize", () => {
  it("returns defaults for missing tag payloads", () => {
    expect(parseCourseStorePricing(undefined)).toEqual({
      ios: {
        enabled: false,
        productId: "",
        displayPriceLabel: "",
        priceTierHintCents: null,
      },
      android: {
        enabled: false,
        productId: "",
        displayPriceLabel: "",
        priceTierHintCents: null,
      },
    });
  });

  it("parses and serializes enabled platform pricing", () => {
    const parsed = parseCourseStorePricing({
      ios: {
        enabled: true,
        productId: " com.school.course ",
        displayPriceLabel: " $9.99 ",
        priceTierHintCents: 999.4,
      },
      android: {
        enabled: false,
        productId: "course_android",
        displayPriceLabel: "",
        priceTierHintCents: null,
      },
    });

    expect(parsed.ios).toEqual({
      enabled: true,
      productId: "com.school.course",
      displayPriceLabel: "$9.99",
      priceTierHintCents: 999,
    });

    expect(serializeCourseStorePricing(parsed)).toEqual(parsed);
  });

  it("domain parser reads studioStorePricing from course metadata tags", () => {
    const pricing = readCourseStorePricingFromMetadata({
      tags: {
        [STORE_PRICING_TAG_KEY]: {
          ios: {
            enabled: true,
            productId: "ios.product",
            displayPriceLabel: "$4.99",
            priceTierHintCents: 499,
          },
          android: {
            enabled: true,
            productId: "android.product",
            displayPriceLabel: "₹399",
            priceTierHintCents: 39900,
          },
        },
      },
    });

    expect(pricing.ios.productId).toBe("ios.product");
    expect(toPublicStorePlatformPricing(pricing.android)).toEqual({
      enabled: true,
      productId: "android.product",
      displayPriceLabel: "₹399",
      priceTierHintCents: 39900,
    });
    expect(toPublicStorePlatformPricing(parseDomainStorePricing({}).ios).enabled).toBe(false);
  });
});
