import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_BROWSER_JOURNEYS } from "../../browser/journeys-registry";

const repoRoot = resolve(import.meta.dirname, "../../..");
const browserRoot = resolve(repoRoot, "tests/browser");

describe("F8 hardening infrastructure", () => {
  it("maps all 11 required browser journeys to Playwright specs", () => {
    expect(REQUIRED_BROWSER_JOURNEYS).toHaveLength(11);
    for (const journey of REQUIRED_BROWSER_JOURNEYS) {
      expect(existsSync(resolve(browserRoot, journey.spec))).toBe(true);
    }
  });

  // Lighthouse CI (@lhci/cli) was removed on 2026-10-06 (SEC-09); the page-load
  // check now runs on Playwright (pnpm perf:web-vitals).
  it("includes Playwright, the page-load check and the Suspense dashboard island", () => {
    expect(existsSync(resolve(repoRoot, "playwright.config.ts"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "playwright.web-vitals.config.mjs"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "tests/performance/web-vitals.spec.ts"))).toBe(true);
    const manifest = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts["perf:web-vitals"]).toContain("playwright.web-vitals.config.mjs");
    const homePage = readFileSync(resolve(repoRoot, "frontend/apps/web/src/app/page.tsx"), "utf8");
    expect(homePage).toContain("Suspense");
    expect(homePage).toContain("DashboardPersonalizedIsland");
  });

  it("includes strict API closure and bundle boundary scripts", () => {
    expect(existsSync(resolve(repoRoot, "configs/ci/frontend-api-closure.json"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "scripts/ci/check-frontend-api-closure.mjs"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "scripts/ci/check-learner-bundle-boundary.mjs"))).toBe(
      true,
    );
    const closure = readFileSync(
      resolve(repoRoot, "scripts/ci/check-frontend-api-closure.mjs"),
      "utf8",
    );
    expect(closure).toContain("STRICT_API_CLOSURE");
  });

  it("includes axe, keyboard, and visual regression suites", () => {
    expect(existsSync(resolve(browserRoot, "accessibility/axe-public-routes.spec.ts"))).toBe(true);
    expect(existsSync(resolve(browserRoot, "accessibility/axe-learner-routes.spec.ts"))).toBe(true);
    expect(existsSync(resolve(browserRoot, "accessibility/keyboard-flows.spec.ts"))).toBe(true);
    expect(existsSync(resolve(browserRoot, "visual/branding-shells.spec.ts"))).toBe(true);
  });

  it("axe fixture scans for critical violations helper", () => {
    const axeFixture = readFileSync(resolve(browserRoot, "fixtures/axe.ts"), "utf8");
    expect(axeFixture).toContain("@axe-core/playwright");
    expect(axeFixture).toContain("assertNoCriticalViolations");
  });
});
