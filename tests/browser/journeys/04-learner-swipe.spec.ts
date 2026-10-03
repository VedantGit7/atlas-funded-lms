import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasLearnerCredentials, requiredCredential } from "../helpers/env";

test.describe("J04 shell smoke: learner swipe page", () => {
  test.beforeEach(() => {
    test.skip(!hasLearnerCredentials(), "Set E2E_LEARNER_EMAIL and E2E_LEARNER_PASSWORD");
  });

  test("swipe surface loads for authenticated learner", async ({ page }) => {
    await loginWithCredentials(
      page,
      requiredCredential("E2E_LEARNER_EMAIL"),
      requiredCredential("E2E_LEARNER_PASSWORD"),
    );
    await page.goto("/swipe");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
