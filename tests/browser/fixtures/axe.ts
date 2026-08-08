import AxeBuilder from "@axe-core/playwright";
import { test as base, expect } from "@playwright/test";

type AxeFixtures = {
  assertNoCriticalViolations: () => Promise<void>;
};

export const test = base.extend<AxeFixtures>({
  assertNoCriticalViolations: async ({ page }, use) => {
    await use(async () => {
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );
      expect(critical, formatViolations(critical)).toEqual([]);
    });
  },
});

export { expect } from "@playwright/test";

function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
): string {
  if (violations.length === 0) {
    return "";
  }
  return violations
    .map((violation) => `${violation.id}: ${violation.help} (${violation.impact})`)
    .join("\n");
}
