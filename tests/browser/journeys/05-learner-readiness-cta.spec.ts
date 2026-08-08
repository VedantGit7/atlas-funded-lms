import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasLearnerCredentials } from "../helpers/env";

test.describe("J05 learner readiness CTA", () => {
  test.beforeEach(() => {
    test.skip(!hasLearnerCredentials(), "Set E2E_LEARNER_EMAIL and E2E_LEARNER_PASSWORD");
  });

  test("readiness surface loads for authenticated learner", async ({ page }) => {
    await loginWithCredentials(
      page,
      process.env["E2E_LEARNER_EMAIL"]!,
      process.env["E2E_LEARNER_PASSWORD"]!,
    );
    await page.goto("/readiness");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
