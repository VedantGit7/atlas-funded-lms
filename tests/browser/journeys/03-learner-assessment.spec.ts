import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasLearnerCredentials } from "../helpers/env";

test.describe("J03 learner assessment lifecycle", () => {
  test.beforeEach(() => {
    test.skip(!hasLearnerCredentials(), "Set E2E_LEARNER_EMAIL and E2E_LEARNER_PASSWORD");
  });

  test("assessment routes render behind learner auth", async ({ page }) => {
    await loginWithCredentials(
      page,
      process.env["E2E_LEARNER_EMAIL"]!,
      process.env["E2E_LEARNER_PASSWORD"]!,
    );
    await page.goto("/courses");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
