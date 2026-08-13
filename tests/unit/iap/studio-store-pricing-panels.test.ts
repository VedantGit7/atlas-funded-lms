import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const studioRoot = resolve(
  import.meta.dirname,
  "../../../frontend/apps/web/src/features/studio/courses",
);

describe("studio iOS/Android pricing panels", () => {
  it("marks ios-pricing and android-pricing as available", () => {
    const metadata = readFileSync(resolve(studioRoot, "course-settings-metadata.ts"), "utf8");
    expect(metadata).toMatch(/id:\s*"android-pricing"[\s\S]*?available:\s*true/);
    expect(metadata).toMatch(/id:\s*"ios-pricing"[\s\S]*?available:\s*true/);
  });

  it("wires dedicated panels instead of Coming soon", () => {
    const page = readFileSync(resolve(studioRoot, "course-settings-page.tsx"), "utf8");
    expect(page).toContain("CourseSettingsIosPricingPanel");
    expect(page).toContain("CourseSettingsAndroidPricingPanel");
    expect(page).toContain('card.id === "ios-pricing"');
    expect(page).toContain('card.id === "android-pricing"');

    expect(existsSync(resolve(studioRoot, "course-settings-ios-pricing-panel.tsx"))).toBe(true);
    expect(existsSync(resolve(studioRoot, "course-settings-android-pricing-panel.tsx"))).toBe(true);

    const iosPanel = readFileSync(
      resolve(studioRoot, "course-settings-ios-pricing-panel.tsx"),
      "utf8",
    );
    const androidPanel = readFileSync(
      resolve(studioRoot, "course-settings-android-pricing-panel.tsx"),
      "utf8",
    );
    expect(iosPanel).not.toContain("Coming soon");
    expect(androidPanel).not.toContain("Coming soon");
    expect(iosPanel).toContain('platform="ios"');
    expect(androidPanel).toContain('platform="android"');
  });

  it("persists via course tags studioStorePricing", () => {
    const settings = readFileSync(resolve(studioRoot, "course-store-pricing-settings.ts"), "utf8");
    expect(settings).toContain("studioStorePricing");
    expect(settings).toContain("mergeCourseStorePlatformPricingIntoTags");

    const panel = readFileSync(
      resolve(studioRoot, "course-settings-store-pricing-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("mergeCourseStorePlatformPricingIntoTags");
    expect(panel).toContain("`/api/v1/courses/${course.id}`");
  });
});
