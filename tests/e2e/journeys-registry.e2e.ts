import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_BROWSER_JOURNEYS } from "../browser/journeys-registry";

const browserRoot = resolve(import.meta.dirname, "../browser");

describe("F8 browser journeys registry", () => {
  it("covers architecture §25.4 journey list", () => {
    expect(REQUIRED_BROWSER_JOURNEYS.map((journey) => journey.id)).toEqual([
      "J01",
      "J02",
      "J03",
      "J04",
      "J05",
      "J06",
      "J07",
      "J08",
      "J09",
      "J10",
      "J11",
    ]);
  });

  it("keeps authenticated journeys behind credential env gates", () => {
    const authenticated = REQUIRED_BROWSER_JOURNEYS.filter((journey) => "requiresAuth" in journey);
    expect(authenticated.length).toBeGreaterThanOrEqual(8);
    for (const journey of authenticated) {
      const source = readFileSync(resolve(browserRoot, journey.spec), "utf8");
      expect(source).toMatch(
        /test\.skip|hasLearnerCredentials|hasAdminCredentials|hasPlatformCredentials|hasInstructorCredentials/,
      );
    }
  });
});

describe("F8 accessibility and visual folders", () => {
  it("includes axe public route scans", () => {
    expect(existsSync(resolve(browserRoot, "accessibility/axe-public-routes.spec.ts"))).toBe(true);
  });

  it("includes visual regression shell spec", () => {
    expect(existsSync(resolve(browserRoot, "visual/branding-shells.spec.ts"))).toBe(true);
  });
});
